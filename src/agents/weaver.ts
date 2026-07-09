/**
 * WeaverAgent — the buyer/orchestrator that turns a dream into fulfilled work
 * by hiring specialist agents through CAP.
 *
 * For each subtask the Weaver:
 *   1. discover()s candidate sellers on CAP (L2) and picks the best-rated match;
 *   2. negotiate()s terms at the seller's advertised price (Negotiate);
 *   3. lock()s USDC into escrow (Lock);
 *   4. lets the seller deliver() an artifact + proof (Deliver);
 *   5. clear()s the order after verifying the proof (Clear) — releasing escrow.
 *
 * The Weaver hires MULTIPLE DISTINCT sellers, which is exactly what the
 * hackathon's anti-sybil rules reward (>=3 unique counterparty agents) and what
 * "A2A composability" means in practice: an agent whose job is done by hiring
 * other agents.
 */

import { Agent } from "./agent.js";
import type { CapClient } from "../cap/client.js";
import type { AgentDID, Order, OrderTerms } from "../cap/types.js";
import { OrderPhase } from "../cap/types.js";
import { verifyInlineArtifact } from "../cap/proof.js";
import { planDream, type Dream, type Subtask } from "../dream.js";
import { formatUsdc } from "../util/money.js";

export interface HireResult {
  subtask: Subtask;
  seller: AgentDID;
  order: Order;
  artifact?: string;
}

export interface WeaveReport {
  dream: Dream;
  hires: HireResult[];
  totalSpentUsdc: bigint;
  uniqueSellers: number;
  cleared: number;
  voided: number;
}

export type Logger = (event: string, data?: Record<string, unknown>) => void;

/**
 * Seller-side driver: lets the Weaver stay fully decoupled from seller
 * internals. `accept` is called during Negotiate (before Lock); `deliver` is
 * called after Lock. In the demo these dispatch to local seller objects; over a
 * network they'd be RPC calls to independently-hosted agents.
 */
export interface SellerDriver {
  accept(orderId: string, seller: AgentDID): Promise<void>;
  deliver(orderId: string, seller: AgentDID): Promise<void>;
}

export class WeaverAgent extends Agent {
  constructor(
    cap: CapClient,
    private readonly seller: SellerDriver,
    private readonly log: Logger = () => {},
    did: AgentDID = "did:erc8004:weaver.dreamweave",
  ) {
    super(cap, {
      did,
      name: "Weaver",
      payoutAddress: "0x000000000000000000000000000000000000WEAVE",
      reputation: 90,
    });
  }

  /** Fulfil a dream end to end, returning a report with anti-sybil metrics. */
  async weave(goal: string): Promise<WeaveReport> {
    const dream = planDream(goal);
    this.log("dream.planned", { goal, subtasks: dream.subtasks.length });

    const hires: HireResult[] = [];
    for (const subtask of dream.subtasks) {
      hires.push(await this.hireFor(subtask));
    }

    const cleared = hires.filter((h) => h.order.phase === OrderPhase.Clear);
    const voided = hires.filter((h) => h.order.phase === OrderPhase.Void);
    const totalSpent = cleared.reduce(
      (sum, h) => sum + h.order.terms.priceUsdc,
      0n,
    );
    const uniqueSellers = new Set(hires.map((h) => h.seller)).size;

    const report: WeaveReport = {
      dream,
      hires,
      totalSpentUsdc: totalSpent,
      uniqueSellers,
      cleared: cleared.length,
      voided: voided.length,
    };
    this.log("dream.woven", {
      cleared: report.cleared,
      voided: report.voided,
      uniqueSellers,
      totalSpent: formatUsdc(totalSpent),
    });
    return report;
  }

  /** Discover, hire, escrow, verify and settle a single subtask. */
  private async hireFor(subtask: Subtask): Promise<HireResult> {
    const candidates = await this.cap.discover({
      capabilityId: subtask.capabilityId,
    });
    if (candidates.length === 0) {
      throw new Error(`no seller offers ${subtask.capabilityId}`);
    }
    const seller = candidates[0]!; // best reputation first
    const cap = seller.capabilities.find((c) => c.id === subtask.capabilityId)!;
    this.log("hire.matched", {
      capability: subtask.capabilityId,
      seller: seller.name,
      price: formatUsdc(cap.priceUsdc),
    });

    const terms: OrderTerms = {
      capabilityId: subtask.capabilityId,
      brief: subtask.brief,
      priceUsdc: cap.priceUsdc,
      deadline: Number.MAX_SAFE_INTEGER, // demo: no timeout pressure
    };

    // Negotiate
    let order = await this.cap.negotiate(this.did, seller.did, terms);
    this.log("order.negotiate", { order: order.id, seller: seller.name });

    // Seller accepts the terms (before escrow is funded).
    await this.seller.accept(order.id, seller.did);
    this.log("order.accept", { order: order.id, seller: seller.name });

    // Lock (fund escrow)
    order = await this.cap.lock(order.id, this.did);
    this.log("order.lock", {
      order: order.id,
      escrow: formatUsdc(order.escrowedUsdc),
    });

    // Seller delivers (driven via hook so buyer/seller stay decoupled)
    await this.seller.deliver(order.id, seller.did);
    order = (await this.cap.getOrder(order.id))!;
    this.log("order.deliver", {
      order: order.id,
      resultHash: order.proof?.resultHash?.slice(0, 18) + "…",
    });

    // Clear (verify proof, release escrow)
    order = await this.cap.clear(order.id, this.did, verifyInlineArtifact);
    this.log("order.clear", {
      order: order.id,
      phase: order.phase,
      settlement: order.settlementRef,
    });

    const artifact = order.proof
      ? decodeInline(order.proof.artifactUri)
      : undefined;

    return { subtask, seller: seller.did, order, artifact };
  }
}

function decodeInline(uri: string): string | undefined {
  const prefix = "data:text/plain,";
  return uri.startsWith(prefix)
    ? decodeURIComponent(uri.slice(prefix.length))
    : undefined;
}
