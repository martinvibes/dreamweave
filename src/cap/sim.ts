/**
 * SimCapClient — a local, deterministic implementation of the CAP lifecycle.
 *
 * It is NOT a mock that rubber-stamps everything: it enforces the real CAP
 * state machine and its money rules, so agent code exercised against it is the
 * same code that will run against on-chain CAP:
 *
 *   - phase transitions are guarded (can't Lock before Accept, can't Clear
 *     before Deliver, etc.);
 *   - escrow is actually debited from the buyer's USDC balance at Lock and
 *     credited to the seller only at Clear ("no proof, no payment");
 *   - a failed proof verification refunds the buyer and Voids the order;
 *   - deadlines are enforced.
 *
 * Determinism: no wall-clock or RNG is used for identifiers. A monotonic
 * counter + injectable `now()` keep runs reproducible and test-friendly.
 */

import type { CapClient } from "./client.js";
import {
  type AgentCard,
  type AgentDID,
  type DeliveryProof,
  type Order,
  type OrderTerms,
  OrderPhase,
  type ProofVerifier,
  type UsdcAmount,
} from "./types.js";

export interface SimOptions {
  /** Injectable clock (ms). Defaults to a fixed epoch for reproducibility. */
  now?: () => number;
  /** Starting USDC balance (base units) granted to each registered agent. */
  startingBalanceUsdc?: UsdcAmount;
}

export class CapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapError";
  }
}

export class SimCapClient implements CapClient {
  private agents = new Map<AgentDID, AgentCard>();
  private balances = new Map<AgentDID, UsdcAmount>();
  private orders = new Map<string, Order>();
  private seq = 0;
  private clockTick = 0;
  private readonly now: () => number;
  private readonly startingBalance: UsdcAmount;

  constructor(opts: SimOptions = {}) {
    // Default clock: a fixed base plus a monotonic tick, so ordering is stable
    // across runs without touching Date.now().
    this.startingBalance = opts.startingBalanceUsdc ?? 0n;
    this.now =
      opts.now ??
      (() => {
        this.clockTick += 1000;
        return 1_781_000_000_000 + this.clockTick;
      });
  }

  // --- balances (test/demo helpers; on-chain this is the USDC contract) ---

  fund(did: AgentDID, amount: UsdcAmount): void {
    this.balances.set(did, (this.balances.get(did) ?? 0n) + amount);
  }

  balanceOf(did: AgentDID): UsdcAmount {
    return this.balances.get(did) ?? 0n;
  }

  // --- L1 / L2 ---

  async register(card: AgentCard): Promise<AgentCard> {
    this.agents.set(card.did, card);
    if (!this.balances.has(card.did)) {
      this.balances.set(card.did, this.startingBalance);
    }
    return card;
  }

  async discover(query: {
    tag?: string;
    capabilityId?: string;
  }): Promise<AgentCard[]> {
    const out: AgentCard[] = [];
    for (const card of this.agents.values()) {
      const match = card.capabilities.some((c) => {
        if (query.capabilityId && c.id !== query.capabilityId) return false;
        if (query.tag && !c.tags.includes(query.tag)) return false;
        return true;
      });
      if (match) out.push(card);
    }
    // Rank by reputation desc for deterministic, sensible selection.
    return out.sort((a, b) => b.reputation - a.reputation);
  }

  async getAgent(did: AgentDID): Promise<AgentCard | undefined> {
    return this.agents.get(did);
  }

  // --- order lifecycle ---

  async negotiate(
    buyer: AgentDID,
    seller: AgentDID,
    terms: OrderTerms,
  ): Promise<Order> {
    this.mustExist(buyer, "buyer");
    const sellerCard = this.mustExist(seller, "seller");
    const cap = sellerCard.capabilities.find((c) => c.id === terms.capabilityId);
    if (!cap) {
      throw new CapError(
        `seller ${seller} does not offer capability ${terms.capabilityId}`,
      );
    }
    const ts = this.now();
    const order: Order = {
      id: `cap-order-${(this.seq += 1)}`,
      buyer,
      seller,
      terms,
      phase: OrderPhase.Negotiate,
      accepted: false,
      escrowedUsdc: 0n,
      createdAt: ts,
      updatedAt: ts,
    };
    this.orders.set(order.id, order);
    return { ...order };
  }

  async accept(orderId: string, seller: AgentDID): Promise<Order> {
    const order = this.mustOrder(orderId);
    this.assertParty(order.seller, seller, "seller");
    this.assertPhase(order, OrderPhase.Negotiate);
    order.accepted = true;
    return this.touch(order);
  }

  async reject(orderId: string, by: AgentDID, reason: string): Promise<Order> {
    const order = this.mustOrder(orderId);
    if (by !== order.buyer && by !== order.seller) {
      throw new CapError(`${by} is not a party to ${orderId}`);
    }
    this.assertPhase(order, OrderPhase.Negotiate);
    return this.voidInternal(order, `rejected: ${reason}`);
  }

  async lock(orderId: string, buyer: AgentDID): Promise<Order> {
    const order = this.mustOrder(orderId);
    this.assertParty(order.buyer, buyer, "buyer");
    this.assertPhase(order, OrderPhase.Negotiate);
    if (!order.accepted) {
      throw new CapError(`order ${orderId} must be accepted by the seller before Lock`);
    }
    const price = order.terms.priceUsdc;
    const bal = this.balanceOf(buyer);
    if (bal < price) {
      throw new CapError(
        `buyer ${buyer} has insufficient USDC: need ${price}, have ${bal}`,
      );
    }
    this.balances.set(buyer, bal - price);
    order.escrowedUsdc = price;
    order.phase = OrderPhase.Lock;
    return this.touch(order);
  }

  async deliver(
    orderId: string,
    seller: AgentDID,
    proof: DeliveryProof,
  ): Promise<Order> {
    const order = this.mustOrder(orderId);
    this.assertParty(order.seller, seller, "seller");
    this.assertPhase(order, OrderPhase.Lock);
    if (this.now() > order.terms.deadline) {
      // Late delivery -> refund buyer, void.
      return this.voidInternal(order, "deadline passed before delivery");
    }
    if (!proof.resultHash || !proof.artifactUri) {
      throw new CapError("delivery proof must include resultHash and artifactUri");
    }
    order.proof = proof;
    order.phase = OrderPhase.Deliver;
    return this.touch(order);
  }

  async clear(
    orderId: string,
    buyer: AgentDID,
    verify: ProofVerifier,
  ): Promise<Order> {
    const order = this.mustOrder(orderId);
    this.assertParty(order.buyer, buyer, "buyer");
    this.assertPhase(order, OrderPhase.Deliver);
    const proof = order.proof;
    if (!proof) throw new CapError("no proof present to verify");

    const ok = verify({ ...order }, proof);
    if (!ok) {
      // "No proof, no payment." Failed verification refunds the buyer.
      return this.voidInternal(order, "proof failed verification");
    }
    // Release escrow to seller.
    const seller = order.seller;
    this.balances.set(seller, this.balanceOf(seller) + order.escrowedUsdc);
    order.settlementRef = `sim-settle-${order.id}`;
    order.escrowedUsdc = 0n;
    order.phase = OrderPhase.Clear;
    return this.touch(order);
  }

  async void(orderId: string, by: AgentDID, reason: string): Promise<Order> {
    const order = this.mustOrder(orderId);
    if (by !== order.buyer && by !== order.seller) {
      throw new CapError(`${by} is not a party to ${orderId}`);
    }
    if (order.phase === OrderPhase.Clear || order.phase === OrderPhase.Void) {
      throw new CapError(`order ${orderId} is already terminal (${order.phase})`);
    }
    return this.voidInternal(order, reason);
  }

  async getOrder(orderId: string): Promise<Order | undefined> {
    const o = this.orders.get(orderId);
    return o ? { ...o } : undefined;
  }

  async listOrders(): Promise<Order[]> {
    return [...this.orders.values()].map((o) => ({ ...o }));
  }

  // --- internals ---

  private voidInternal(order: Order, reason: string): Order {
    if (order.escrowedUsdc > 0n) {
      // Refund buyer.
      this.balances.set(order.buyer, this.balanceOf(order.buyer) + order.escrowedUsdc);
      order.escrowedUsdc = 0n;
    }
    order.phase = OrderPhase.Void;
    order.settlementRef = `sim-void-${order.id}: ${reason}`;
    return this.touch(order);
  }

  private touch(order: Order): Order {
    order.updatedAt = this.now();
    this.orders.set(order.id, order);
    return { ...order };
  }

  private mustExist(did: AgentDID, role: string): AgentCard {
    const card = this.agents.get(did);
    if (!card) throw new CapError(`${role} ${did} is not registered`);
    return card;
  }

  private mustOrder(orderId: string): Order {
    const order = this.orders.get(orderId);
    if (!order) throw new CapError(`unknown order ${orderId}`);
    return order;
  }

  private assertParty(expected: AgentDID, actual: AgentDID, role: string): void {
    if (expected !== actual) {
      throw new CapError(`${actual} is not the ${role} for this order`);
    }
  }

  private assertPhase(order: Order, expected: OrderPhase): void {
    if (order.phase !== expected) {
      throw new CapError(
        `order ${order.id} is in phase ${order.phase}, expected ${expected}`,
      );
    }
  }
}
