/**
 * The Weaver as a CROO provider — this is what makes DreamWeave "Online"
 * on the store. A buyer hires `Fulfil an Outcome`; we run the whole
 * orchestration (plan → hire/birth → verify) and deliver the composed
 * result with its proof tree.
 */

import { randomUUID } from "node:crypto";
import { usdc } from "../../src/index.js";
import { startProvider } from "./croo.js";
import { makePlan, weaveDream } from "./orchestrator.js";
import { config } from "./config.js";
import { createDream, getDream, listThreads } from "./repo.js";
import type { ProofLeaf } from "./prooftree.js";

export interface DreamRun {
  artifacts: { agent: string; text: string }[];
  prooftree: { root: string; leaves: ProofLeaf[] };
}

export interface FulfilDeps {
  runDream: (goal: string) => Promise<DreamRun>;
}

/** Internal, dependency-injected — exported for tests. */
export async function _fulfilOutcomeWith(
  deps: FulfilDeps,
  requirements: string,
  orderId: string,
): Promise<string> {
  const run = await deps.runDream(requirements);
  return JSON.stringify({
    orderId,
    result: run.artifacts,
    prooftree: run.prooftree,
    provider: "DreamWeave — hire a team, not an agent",
  });
}

/** Budget the Weaver may spend on sub-hires per buyer order. */
const SUBHIRE_BUDGET = usdc("1.00");

async function runRealDream(goal: string): Promise<DreamRun> {
  const dreamId = `croo-${randomUUID().slice(0, 8)}`;
  const { plan } = await makePlan(goal);
  await createDream({
    id: dreamId,
    owner: "croo-buyer",
    goal,
    budgetUsdc: SUBHIRE_BUDGET,
  });
  await weaveDream(dreamId, plan); // awaited: provider delivers when done

  const dream = await getDream(dreamId);
  const threads = await listThreads(dreamId);
  return {
    artifacts: threads
      .filter((t) => t.phase === "clear" && t.artifact)
      .map((t) => ({ agent: t.sellerName, text: t.artifact ?? "" })),
    prooftree: {
      root: dream?.prooftreeRoot ?? "0x0",
      leaves: JSON.parse(dream?.prooftreeLeaves ?? "[]") as ProofLeaf[],
    },
  };
}

export async function startWeaverProvider(): Promise<(() => void) | undefined> {
  if (!config.croo.live) return undefined;
  console.log("  weaver provider → connecting to CROO store…");
  return startProvider({
    sdkKey: config.croo.sdkKey,
    agentId: config.croo.agentId,
    onJob: (requirements, orderId) =>
      _fulfilOutcomeWith({ runDream: runRealDream }, requirements, orderId),
  });
}
