/**
 * Orchestrator — runs a dream end-to-end. This is the Weaver at work.
 *
 * For each planned subtask it:
 *   1. matches the best agent for the capability (real DB discovery),
 *   2. runs the CAP order lifecycle (Negotiate → Lock → Deliver → Clear) using
 *      the shared engine's escrow state machine,
 *   3. executes the agent for REAL on 0G (or its BYO endpoint) at the Deliver
 *      step, committing a content-hash proof (+ TEE proof) of the output,
 *   4. verifies the proof and releases escrow at Clear — on-chain via DreamVault
 *      when configured, in-process otherwise,
 *   5. persists every transition to the DB and streams it over SSE for the Loom.
 *
 * "No proof, no payment": a thread only settles after its delivery proof
 * verifies. Everything here is real work + real state; nothing is stubbed.
 */

import {
  SimCapClient,
  verifyInlineArtifact,
  formatUsdc,
  OrderPhase,
  type DeliveryProof,
} from "../../src/index.js";
import { executeAgent } from "./agentRunner.js";
import { planDream, type CrewPlan } from "./planner.js";
import { publish, finish } from "./events.js";
import {
  bestAgentFor,
  createThread,
  getDream,
  listAgents,
  recordAgentEarning,
  updateDream,
  updateThread,
  type AgentRow,
} from "./repo.js";
import { chainConfigured, settleThreadOnchain } from "./chain.js";

const WEAVER_DID = "did:erc8004:weaver.dreamweave" as const;

/** Plan a dream (no execution) — used by the "review crew before funding" step. */
export async function makePlan(goal: string): Promise<{
  plan: CrewPlan;
  crew: { capabilityId: string; agent: AgentRow | undefined }[];
  totalUsdc: bigint;
}> {
  const agents = await listAgents();
  const plan = await planDream(goal, agents);
  const crew = await Promise.all(
    plan.subtasks.map(async (s) => ({
      capabilityId: s.capabilityId,
      agent: await bestAgentFor(s.capabilityId),
    })),
  );
  const totalUsdc = crew.reduce((sum, c) => sum + (c.agent?.priceUsdc ?? 0n), 0n);
  return { plan, crew, totalUsdc };
}

/**
 * Execute a planned dream. Streams events to the dream's SSE channel and
 * persists results. Runs in the background (caller does not await).
 */
export async function weaveDream(dreamId: string, plan: CrewPlan): Promise<void> {
  const dream = await getDream(dreamId);
  if (!dream) return;

  const cap = new SimCapClient();
  await cap.register({
    did: WEAVER_DID,
    name: "Weaver",
    payoutAddress: "0x000000000000000000000000000000000000WEAVE",
    reputation: 96,
    capabilities: [],
  });
  cap.fund(WEAVER_DID, dream.budgetUsdc);

  await updateDream(dreamId, { status: "weaving" });
  publish(dreamId, {
    type: "plan",
    goal: dream.goal,
    budgetUsdc: formatUsdc(dream.budgetUsdc),
    planner: plan.planner,
    subtasks: plan.subtasks.length,
  });

  let spent = 0n;

  for (let i = 0; i < plan.subtasks.length; i++) {
    const sub = plan.subtasks[i]!;
    const agent = await bestAgentFor(sub.capabilityId);
    if (!agent) {
      publish(dreamId, {
        type: "log",
        level: "warn",
        text: `no agent offers ${sub.capabilityId} — skipping`,
      });
      continue;
    }

    const threadId = `${dreamId}-t${i}`;
    await createThread({
      id: threadId,
      dreamId,
      agentId: agent.id,
      sellerName: agent.name,
      capabilityId: sub.capabilityId,
      brief: sub.brief,
      priceUsdc: agent.priceUsdc,
      idx: i,
    });

    // Register the seller for this order.
    await cap.register({
      did: agent.did as `did:erc8004:${string}`,
      name: agent.name,
      payoutAddress: agent.payoutAddress ?? "0x0",
      reputation: agent.reputation,
      capabilities: [
        {
          id: agent.capabilityId,
          title: agent.title,
          priceUsdc: agent.priceUsdc,
          tags: agent.tags,
        },
      ],
    });

    const emitPhase = (phase: string, extra: Record<string, unknown> = {}) => {
      publish(dreamId, {
        type: "thread",
        thread: {
          id: threadId,
          idx: i,
          sellerName: agent.name,
          capabilityId: sub.capabilityId,
          priceUsdc: formatUsdc(agent.priceUsdc),
          phase,
          ...extra,
        },
      });
    };

    try {
      // match
      await updateThread(threadId, { phase: "match" });
      emitPhase("match");
      publish(dreamId, {
        type: "log",
        level: "info",
        text: `match · ${agent.name} for ${sub.capabilityId} @ ${formatUsdc(agent.priceUsdc)} USDC (rep ${agent.reputation})`,
      });

      // negotiate
      let order = await cap.negotiate(WEAVER_DID, agent.did as `did:erc8004:${string}`, {
        capabilityId: sub.capabilityId,
        brief: sub.brief,
        priceUsdc: agent.priceUsdc,
        deadline: Number.MAX_SAFE_INTEGER,
      });
      await updateThread(threadId, { phase: "negotiate", capOrderId: order.id });
      emitPhase("negotiate");

      // accept + lock (escrow)
      await cap.accept(order.id, agent.did as `did:erc8004:${string}`);
      order = await cap.lock(order.id, WEAVER_DID);
      await updateThread(threadId, { phase: "lock" });
      emitPhase("lock");
      publish(dreamId, {
        type: "log",
        level: "info",
        text: `lock · ${formatUsdc(order.escrowedUsdc)} USDC escrowed for ${agent.name}`,
      });

      // execute the agent for REAL (0G / endpoint)
      publish(dreamId, {
        type: "log",
        level: "info",
        text: `run · ${agent.name} working via ${agent.runtime === "endpoint" ? "endpoint" : "0G"}…`,
      });
      const delivery = await executeAgent(agent, sub.brief);

      // deliver with proof (content hash + optional TEE proof)
      const proof: DeliveryProof = {
        resultHash: delivery.resultHash,
        artifactUri: `data:text/plain,${encodeURIComponent(delivery.artifact)}`,
        attestation: delivery.teeProof,
      };
      await cap.deliver(order.id, agent.did as `did:erc8004:${string}`, proof);
      await updateThread(threadId, {
        phase: "deliver",
        artifact: delivery.artifact,
        proofHash: delivery.resultHash,
        teeProof: delivery.teeProof,
      });
      emitPhase("deliver", { proofHash: delivery.resultHash });
      publish(dreamId, {
        type: "log",
        level: "info",
        text: `deliver · proof ${delivery.resultHash.slice(0, 20)}…${delivery.teeProof ? " · TEE-attested" : ""}`,
      });

      // clear (verify proof → release escrow)
      order = await cap.clear(order.id, WEAVER_DID, verifyInlineArtifact);
      if (order.phase !== OrderPhase.Clear) {
        await updateThread(threadId, { phase: "void" });
        emitPhase("void");
        publish(dreamId, {
          type: "log",
          level: "warn",
          text: `void · proof failed for ${agent.name}, refunded`,
        });
        continue;
      }

      // settle (on-chain when configured, else in-process)
      let settlementRef = order.settlementRef ?? "";
      let txHash: string | undefined;
      if (chainConfigured() && dream.chainDreamId != null && agent.payoutAddress) {
        txHash = await settleThreadOnchain(dream.chainDreamId, {
          seller: agent.payoutAddress as `0x${string}`,
          amount: agent.priceUsdc,
          capOrderId: order.id,
          proofHash: delivery.resultHash,
        });
        settlementRef = txHash;
      }

      spent += agent.priceUsdc;
      await updateThread(threadId, {
        phase: "clear",
        settlementRef,
        ...(txHash ? { txHash } : {}),
      });
      await recordAgentEarning(agent.id, agent.priceUsdc);
      emitPhase("clear", { settlementRef, txHash });
      publish(dreamId, {
        type: "settle",
        threadId,
        sellerName: agent.name,
        amountUsdc: formatUsdc(agent.priceUsdc),
        settlementRef,
        txHash,
      });
      publish(dreamId, {
        type: "log",
        level: "value",
        text: `clear · ${formatUsdc(agent.priceUsdc)} USDC released to ${agent.name}${txHash ? ` · ${txHash.slice(0, 14)}…` : ""}`,
      });
    } catch (err) {
      await updateThread(threadId, { phase: "void" });
      emitPhase("void");
      publish(dreamId, {
        type: "log",
        level: "warn",
        text: `error · ${agent.name}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const refunded = dream.budgetUsdc - spent;
  await updateDream(dreamId, { status: "settled", spentUsdc: spent });
  publish(dreamId, {
    type: "log",
    level: "value",
    text: `vault close · spent ${formatUsdc(spent)} USDC · ${formatUsdc(refunded)} USDC unspent refunded to sponsor`,
  });
  publish(dreamId, {
    type: "done",
    spentUsdc: formatUsdc(spent),
    refundedUsdc: formatUsdc(refunded),
    budgetUsdc: formatUsdc(dream.budgetUsdc),
  });
  finish(dreamId);
}
