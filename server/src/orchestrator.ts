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
  hashArtifact,
  OrderPhase,
  type DeliveryProof,
} from "../../src/index.js";
import { executeAgent } from "./agentRunner.js";
import { planDream, type CrewPlan } from "./planner.js";
import { publish, finish } from "./events.js";
import { resolveCapability } from "./catalog.js";
import { hireService, type HireResult } from "./croo.js";
import { birthAgent } from "./foundry.js";
import { computeRoot, type ProofLeaf } from "./prooftree.js";
import { config } from "./config.js";
import {
  createThread,
  getDream,
  listAgents,
  recordAgentEarning,
  updateDream,
  updateThread,
  type AgentRow,
} from "./repo.js";

const WEAVER_DID = "did:erc8004:weaver.dreamweave" as const;

/** What a planned hire will look like — store agent, in-house, or a birth. */
export interface PlannedHire {
  capabilityId: string;
  brief: string;
  source: "store" | "local" | "new";
  name: string;
  priceUsdc: bigint;
  agent?: AgentRow;
}

const NEWBORN_PRICE = 500000n; // 0.50 USDC — what a Foundry child charges

/** Plan a dream (no execution) — used by the "review crew before funding" step. */
export async function makePlan(goal: string): Promise<{
  plan: CrewPlan;
  crew: PlannedHire[];
  totalUsdc: bigint;
}> {
  const agents = await listAgents();
  const plan = await planDream(goal, agents);
  const crew: PlannedHire[] = await Promise.all(
    plan.subtasks.map(async (s) => {
      const r = await resolveCapability(s.capabilityId);
      if (r.kind === "store") {
        return {
          capabilityId: s.capabilityId,
          brief: s.brief,
          source: "store" as const,
          name: r.name,
          priceUsdc: r.priceUsdc,
        };
      }
      if (r.kind === "local") {
        return {
          capabilityId: s.capabilityId,
          brief: s.brief,
          source: "local" as const,
          name: r.agent.name,
          priceUsdc: r.agent.priceUsdc,
          agent: r.agent,
        };
      }
      return {
        capabilityId: s.capabilityId,
        brief: s.brief,
        source: "new" as const,
        name: "a specialist to be created",
        priceUsdc: NEWBORN_PRICE,
      };
    }),
  );
  const totalUsdc = crew.reduce((sum, c) => sum + c.priceUsdc, 0n);
  return { plan, crew, totalUsdc };
}

/** Store-hire path for one subtask. Exported for tests (deps injected). */
export async function _runStoreSubtask(
  deps: {
    hire: (opts: { serviceId: string; requirements: string }) => Promise<HireResult>;
    emit: (phase: string, extra?: Record<string, unknown>) => void;
  },
  ctx: { serviceId: string; name: string; requirements: string },
): Promise<ProofLeaf> {
  deps.emit("negotiate");
  const hired = await deps.hire({
    serviceId: ctx.serviceId,
    requirements: ctx.requirements,
  });
  deps.emit("lock", { payTxHash: hired.payTxHash });
  deps.emit("deliver");
  const leaf: ProofLeaf = {
    orderId: hired.orderId,
    serviceId: ctx.serviceId,
    agent: ctx.name,
    role: "hired",
    deliverableHash: hashArtifact(hired.deliverableText),
    payTxHash: hired.payTxHash,
  };
  deps.emit("clear", { settlementRef: hired.orderId });
  return leaf;
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

  const leaves: ProofLeaf[] = [];

  for (let i = 0; i < plan.subtasks.length; i++) {
    const sub = plan.subtasks[i]!;
    let resolution = await resolveCapability(sub.capabilityId);

    // Genesis: nobody offers this skill — the Foundry births someone who does.
    if (resolution.kind === "missing" && config.croo.live) {
      publish(dreamId, {
        type: "log",
        level: "warn",
        text: `no agent offers ${sub.capabilityId} — commissioning the Foundry`,
      });
      try {
        const born = await birthAgent({ capabilityId: sub.capabilityId, brief: sub.brief });
        publish(dreamId, {
          type: "birth",
          agent: {
            name: born.agent.name,
            capabilityId: sub.capabilityId,
            storeUrl:
              born.serviceId === "local"
                ? null
                : `https://agent.croo.network/agents/${born.sdkKey ? born.agent.crooServiceId ?? born.serviceId : born.serviceId}`,
          },
        });
        publish(dreamId, {
          type: "log",
          level: "value",
          text: `birth · ${born.agent.name} born for ${sub.capabilityId}${born.serviceId !== "local" ? " — live on the CROO store" : ""}`,
        });
        resolution =
          born.serviceId === "local"
            ? { kind: "local", agent: born.agent }
            : {
                kind: "store",
                serviceId: born.serviceId,
                name: born.agent.name,
                priceUsdc: born.agent.priceUsdc,
              };
      } catch (err) {
        publish(dreamId, {
          type: "log",
          level: "warn",
          text: `foundry failed for ${sub.capabilityId}: ${(err as Error).message}`,
        });
      }
    }
    if (resolution.kind === "missing") {
      publish(dreamId, {
        type: "log",
        level: "warn",
        text: `no agent offers ${sub.capabilityId} — skipping`,
      });
      continue;
    }

    const threadId = `${dreamId}-t${i}`;

    // ---- store path: a real CROO order to a real (or newborn) agent -------
    if (resolution.kind === "store") {
      const { serviceId, name, priceUsdc } = resolution;
      if (spent + priceUsdc > dream.budgetUsdc) {
        publish(dreamId, {
          type: "log",
          level: "warn",
          text: `budget exhausted — skipping ${name} (${formatUsdc(priceUsdc)} USDC)`,
        });
        continue;
      }
      await createThread({
        id: threadId,
        dreamId,
        agentId: serviceId,
        sellerName: name,
        capabilityId: sub.capabilityId,
        brief: sub.brief,
        priceUsdc,
        idx: i,
      });
      const emitStorePhase = (phase: string, extra: Record<string, unknown> = {}) => {
        publish(dreamId, {
          type: "thread",
          thread: {
            id: threadId,
            idx: i,
            sellerName: name,
            capabilityId: sub.capabilityId,
            priceUsdc: formatUsdc(priceUsdc),
            phase,
            store: true,
            ...extra,
          },
        });
      };
      try {
        await updateThread(threadId, { phase: "match" });
        emitStorePhase("match");
        publish(dreamId, {
          type: "log",
          level: "info",
          text: `match · ${name} on the CROO store for ${sub.capabilityId} @ ${formatUsdc(priceUsdc)} USDC`,
        });
        let deliveredText = "";
        const leaf = await _runStoreSubtask(
          {
            hire: async (o) => {
              const r = await hireService(o);
              deliveredText = r.deliverableText;
              return r;
            },
            emit: async (phase, extra = {}) => {
              await updateThread(threadId, { phase: phase as never });
              emitStorePhase(phase, extra);
            },
          },
          { serviceId, name, requirements: sub.brief },
        );
        leaves.push(leaf);
        spent += priceUsdc;
        await updateThread(threadId, {
          phase: "clear",
          artifact: deliveredText,
          proofHash: leaf.deliverableHash,
          settlementRef: leaf.orderId,
          ...(leaf.payTxHash ? { txHash: leaf.payTxHash } : {}),
        });
        publish(dreamId, {
          type: "settle",
          threadId,
          sellerName: name,
          amountUsdc: formatUsdc(priceUsdc),
          settlementRef: leaf.orderId,
          txHash: leaf.payTxHash,
        });
        publish(dreamId, {
          type: "log",
          level: "value",
          text: `clear · ${formatUsdc(priceUsdc)} USDC paid to ${name} on CROO · order ${leaf.orderId.slice(0, 8)}…`,
        });
      } catch (err) {
        await updateThread(threadId, { phase: "void" });
        emitStorePhase("void");
        publish(dreamId, {
          type: "log",
          level: "warn",
          text: `void · store hire failed for ${name}: ${(err as Error).message}`,
        });
      }
      continue;
    }

    // ---- local path: our own agent through the in-process CAP engine ------
    const agent = resolution.agent;
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

      // settle (CROO settles orders on-chain; locally the engine settles in-process)
      const settlementRef = order.settlementRef ?? "";

      spent += agent.priceUsdc;
      leaves.push({
        orderId: order.id,
        serviceId: agent.crooServiceId ?? "sim",
        agent: agent.name,
        role: agent.parentId === "foundry" ? "born" : "local",
        deliverableHash: delivery.resultHash,
        teeAttestation: delivery.teeProof,
      });
      await updateThread(threadId, {
        phase: "clear",
        settlementRef,
      });
      await recordAgentEarning(agent.id, agent.priceUsdc);
      emitPhase("clear", { settlementRef });
      publish(dreamId, {
        type: "settle",
        threadId,
        sellerName: agent.name,
        amountUsdc: formatUsdc(agent.priceUsdc),
        settlementRef,
      });
      publish(dreamId, {
        type: "log",
        level: "value",
        text: `clear · ${formatUsdc(agent.priceUsdc)} USDC released to ${agent.name}`,
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

  // One fingerprint over every sub-job — ships inside the CAP delivery.
  const root = computeRoot(leaves);
  publish(dreamId, { type: "prooftree", root, leaves });
  publish(dreamId, {
    type: "log",
    level: "value",
    text: `prooftree · root ${root.slice(0, 22)}… over ${leaves.length} verified deliveries`,
  });

  const refunded = dream.budgetUsdc - spent;
  await updateDream(dreamId, {
    status: "settled",
    spentUsdc: spent,
    prooftreeRoot: root,
    prooftreeLeaves: JSON.stringify(leaves),
  });
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
