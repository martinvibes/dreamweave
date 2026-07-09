/**
 * LLM client — provider-agnostic, OpenAI-compatible Chat Completions.
 *
 * DreamWeave agents do REAL work through this client. It targets any endpoint
 * that speaks the OpenAI /chat/completions shape:
 *
 *   - 0G Private Computer (pc.0g.ai) — decentralized models with on-chain TEE
 *     inference proofs. Set LLM_BASE_URL to the 0G endpoint, LLM_TEE_PROOFS=1,
 *     and each completion carries a verifiable proof we thread into the CAP
 *     delivery (this is the "proof" in "no proof, no payment").
 *   - OpenAI / OpenRouter / any compatible gateway.
 *
 * No mocks: if no LLM_API_KEY is configured the call throws, so a
 * platform-run agent cannot silently "succeed" without real inference.
 */

import { config } from "./config.js";

export interface CompletionResult {
  text: string;
  model: string;
  /** 0G TEE inference proof, when the provider returns one. */
  teeProof?: string;
  /** Raw token usage if the provider reports it. */
  usage?: { prompt: number; completion: number };
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Run a chat completion. Returns the assistant text plus (if the provider is
 * 0G PC) the TEE inference proof.
 */
export async function complete(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; model?: string } = {},
): Promise<CompletionResult> {
  const { baseUrl, apiKey } = config.llm;
  const model = opts.model ?? config.llm.model;
  if (!apiKey) {
    throw new LlmError(
      "LLM_API_KEY not set — platform-run agents need a real model. " +
        "Point LLM_BASE_URL/LLM_API_KEY/LLM_MODEL at 0G PC (pc.0g.ai) or an " +
        "OpenAI-compatible endpoint.",
    );
  }

  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
        // 0G models like deepseek/glm are reasoning models — they spend tokens
        // on hidden reasoning before content, so give generous headroom.
        max_tokens: opts.maxTokens ?? 1600,
        // 0G: request on-chain TEE signature verification. The response trace
        // carries verification + provider — our verifiable "proof of delivery".
        ...(config.llm.teeProofs ? { verify_tee: true } : {}),
      }),
    });
  } catch (err) {
    throw new LlmError(`LLM request failed: ${String(err)}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LlmError(`LLM ${res.status}: ${body.slice(0, 400)}`, res.status);
  }

  const data = (await res.json()) as {
    choices?: {
      finish_reason?: string;
      message?: { content?: string; reasoning_content?: string };
    }[];
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    tee_verified?: boolean;
    x_0g_trace?: {
      tee_verified?: boolean;
      signature?: string;
      provider?: string;
      request_id?: string;
    };
  };

  const choice = data.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) {
    // Reasoning model ran out of budget before emitting content.
    if (choice?.finish_reason === "length") {
      throw new LlmError(
        "LLM hit the token limit before producing an answer (reasoning model) — raise max_tokens",
      );
    }
    throw new LlmError("LLM returned an empty completion");
  }

  // 0G surfaces verification + provider in x_0g_trace. Capture the strongest
  // proof available: an explicit signature, else the attested provider+request.
  const trace = data.x_0g_trace;
  const teeVerified = data.tee_verified ?? trace?.tee_verified ?? false;
  const teeProof =
    config.llm.teeProofs && trace
      ? trace.signature ??
        `0g:${trace.provider ?? "provider"}:${trace.request_id ?? ""}${teeVerified ? ":verified" : ""}`
      : undefined;

  return {
    text,
    model: data.model ?? model,
    teeProof,
    usage: data.usage
      ? {
          prompt: data.usage.prompt_tokens ?? 0,
          completion: data.usage.completion_tokens ?? 0,
        }
      : undefined,
  };
}

/** True when a real model is configured (used to gate platform-run agents). */
export function llmConfigured(): boolean {
  return Boolean(config.llm.apiKey);
}
