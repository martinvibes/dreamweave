/**
 * Agent execution — where an agent actually does the work.
 *
 * Two runtimes (both real, no mocks):
 *   - platform : the agent is defined by a system prompt and runs on 0G PC
 *                (real inference, TEE proof attached).
 *   - endpoint : the agent is an external HTTP service the creator hosts; we
 *                POST the brief and use whatever it returns.
 *
 * Output is committed with a content hash (the CAP delivery proof). When 0G PC
 * returns a TEE inference proof, that rides along as verifiable evidence the
 * work came from the attested model — the strongest form of "proof of delivery".
 */

import { hashArtifact } from "../../src/index.js";
import { complete } from "./llm.js";
import type { AgentRow } from "./repo.js";

export interface Delivery {
  artifact: string;
  resultHash: string;
  teeProof?: string;
  model?: string;
}

export async function executeAgent(
  agent: AgentRow,
  brief: string,
): Promise<Delivery> {
  if (agent.runtime === "endpoint") {
    return runEndpoint(agent, brief);
  }
  return runPlatform(agent, brief);
}

async function runPlatform(agent: AgentRow, brief: string): Promise<Delivery> {
  const system =
    agent.systemPrompt?.trim() ||
    `You are ${agent.name}, a specialist agent offering "${agent.title}". ` +
      `Deliver focused, high-quality, ready-to-use work. Be concise and concrete.`;

  const res = await complete(
    [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `Task brief:\n${brief}\n\n` +
          `Deliver the finished work only — no preamble, no "here is". ` +
          `Return usable output a client would pay for.`,
      },
    ],
    { temperature: 0.7, maxTokens: 1800 },
  );

  return {
    artifact: res.text,
    resultHash: hashArtifact(res.text),
    teeProof: res.teeProof,
    model: res.model,
  };
}

async function runEndpoint(agent: AgentRow, brief: string): Promise<Delivery> {
  if (!agent.endpointUrl) {
    throw new Error(`agent ${agent.name} is runtime=endpoint but has no endpoint_url`);
  }
  const res = await fetch(agent.endpointUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief, capabilityId: agent.capabilityId }),
  });
  if (!res.ok) {
    throw new Error(`agent endpoint ${agent.endpointUrl} returned ${res.status}`);
  }
  const data = (await res.json()) as { artifact?: string; teeProof?: string };
  const artifact = String(data.artifact ?? "").trim();
  if (!artifact) throw new Error(`agent endpoint returned empty artifact`);
  return {
    artifact,
    resultHash: hashArtifact(artifact),
    teeProof: data.teeProof,
  };
}
