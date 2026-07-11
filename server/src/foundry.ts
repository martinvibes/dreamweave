/**
 * The Foundry — DreamWeave's agent that creates agents.
 *
 * When the Weaver needs a skill the store lacks, the Foundry "animates" a
 * vessel: a pre-registered blank CROO store agent (created once in the
 * dashboard, keys in CROO_VESSELS). Animation = give it an identity (LLM),
 * a DB row, a price, and a live provider loop. The newborn is then hired
 * through the real store like any other agent, and owes the Foundry a 10%
 * royalty on everything it ever earns (recorded at delivery time by the
 * provider wrapper here).
 *
 *   CROO_VESSELS='[{"sdkKey":"croo_sk_…","agentId":"…","serviceId":"…"}]'
 */

import { randomUUID } from "node:crypto";
import { usdc } from "../../src/index.js";
import { executeAgent } from "./agentRunner.js";
import { startProvider as realStartProvider } from "./croo.js";
import { complete } from "./llm.js";
import {
  createAgent,
  listAgents,
  recordAgentEarning,
  recordRoyalty,
  ROYALTY_BPS,
  type AgentRow,
} from "./repo.js";

export interface Vessel {
  sdkKey: string;
  agentId: string;
  serviceId: string;
}

export interface BirthDeps {
  vessels: Vessel[];
  generateIdentity: (
    capabilityId: string,
    brief: string,
  ) => Promise<{ name: string; systemPrompt: string }>;
  startProvider: (opts: {
    sdkKey: string;
    agentId?: string;
    onJob: (requirements: string, orderId: string) => Promise<string>;
  }) => Promise<() => void>;
}

const CHILD_PRICE = usdc("0.50");

function envVessels(): Vessel[] {
  const raw = process.env.CROO_VESSELS;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Vessel[];
  } catch {
    console.error("CROO_VESSELS is not valid JSON — ignoring");
    return [];
  }
}

async function llmIdentity(
  capabilityId: string,
  brief: string,
): Promise<{ name: string; systemPrompt: string }> {
  try {
    const res = await complete(
      [
        {
          role: "system",
          content:
            "You design specialist AI agents. Reply with STRICT JSON only: " +
            '{"name": "<one evocative single word>", "systemPrompt": "<2-4 sentence system prompt making the agent a world-class specialist>"}',
        },
        {
          role: "user",
          content: `Capability needed: ${capabilityId}\nFirst job brief: ${brief}`,
        },
      ],
      { temperature: 0.8, maxTokens: 300 },
    );
    const parsed = JSON.parse(res.text) as { name?: string; systemPrompt?: string };
    if (parsed.name && parsed.systemPrompt) {
      return { name: parsed.name, systemPrompt: parsed.systemPrompt };
    }
  } catch {
    /* fall through to template identity */
  }
  return {
    name: `Specialist-${capabilityId.split(".")[0] ?? "x"}`,
    systemPrompt: `You are a world-class specialist in ${capabilityId}. Deliver complete, ready-to-use work.`,
  };
}

/** Internal, dependency-injected — exported for tests. */
export async function _birthWith(
  deps: BirthDeps,
  opts: { capabilityId: string; brief: string },
): Promise<{ agent: AgentRow; serviceId: string; sdkKey: string }> {
  // A vessel is free if no agent row has claimed its serviceId yet.
  const roster = await listAgents();
  const claimed = new Set(roster.map((a) => a.crooServiceId).filter(Boolean));
  const vessel = deps.vessels.find((v) => !claimed.has(v.serviceId));

  const identity = await deps.generateIdentity(opts.capabilityId, opts.brief);
  const agent = await createAgent({
    id: `born-${randomUUID().slice(0, 8)}`,
    owner: "foundry",
    did: `did:erc8004:${identity.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.dreamweave`,
    name: identity.name,
    capabilityId: opts.capabilityId,
    title: `${opts.capabilityId} (born on demand)`,
    priceUsdc: CHILD_PRICE,
    tags: ["born"],
    reputation: 40,
    runtime: "platform",
    systemPrompt: identity.systemPrompt,
    endpointUrl: null,
    payoutAddress: null,
    parentId: "foundry",
    crooServiceId: vessel?.serviceId ?? null,
  });

  if (!vessel) return { agent, serviceId: "local", sdkKey: "" };

  await deps.startProvider({
    sdkKey: vessel.sdkKey,
    agentId: vessel.agentId,
    onJob: async (requirements, orderId) => {
      const delivery = await executeAgent(agent, requirements);
      await recordAgentEarning(agent.id, CHILD_PRICE);
      await recordRoyalty(
        agent.id,
        orderId,
        (CHILD_PRICE * BigInt(ROYALTY_BPS)) / 10000n,
      );
      return JSON.stringify({
        result: delivery.artifact,
        deliverableHash: delivery.resultHash,
        teeAttestation: delivery.teeProof ?? null,
        bornOf: "dreamweave-foundry",
      });
    },
  });

  return { agent, serviceId: vessel.serviceId, sdkKey: vessel.sdkKey };
}

/** Public API. */
export async function birthAgent(opts: {
  capabilityId: string;
  brief: string;
}): Promise<{ agent: AgentRow; serviceId: string; sdkKey: string }> {
  return _birthWith(
    {
      vessels: envVessels(),
      generateIdentity: llmIdentity,
      startProvider: realStartProvider,
    },
    opts,
  );
}
