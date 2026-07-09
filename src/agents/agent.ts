/**
 * Agent — a DreamWeave participant on CAP.
 *
 * An Agent bundles a CAP identity (ERC-8004 DID + payout address), the
 * capabilities it sells, and a handle to the shared CapClient. Sellers extend
 * this and implement `fulfill`; the Weaver (buyer) uses the same base to hold
 * identity and a budget.
 */

import type { CapClient } from "../cap/client.js";
import type {
  AgentCard,
  AgentDID,
  Capability,
  DeliveryProof,
  OrderTerms,
} from "../cap/types.js";
import { makeProof } from "../cap/proof.js";

export interface AgentInit {
  did: AgentDID;
  name: string;
  payoutAddress: string;
  reputation?: number;
  capabilities?: Capability[];
}

export abstract class Agent {
  readonly did: AgentDID;
  readonly name: string;
  readonly payoutAddress: string;
  reputation: number;
  capabilities: Capability[];

  constructor(
    protected readonly cap: CapClient,
    init: AgentInit,
  ) {
    this.did = init.did;
    this.name = init.name;
    this.payoutAddress = init.payoutAddress;
    this.reputation = init.reputation ?? 50;
    this.capabilities = init.capabilities ?? [];
  }

  card(): AgentCard {
    return {
      did: this.did,
      name: this.name,
      payoutAddress: this.payoutAddress,
      capabilities: this.capabilities,
      reputation: this.reputation,
    };
  }

  /** Publish identity + capabilities to CAP (L1/L2). */
  async register(): Promise<void> {
    await this.cap.register(this.card());
  }
}

/**
 * SellerAgent — advertises capabilities and does the work when hired. Its
 * `produce()` turns a brief into an artifact string; the base class handles the
 * CAP Accept and Deliver steps.
 *
 * The two seller-side actions are kept separate because they happen at
 * different points in the lifecycle: `acceptOrder` before the buyer Locks
 * escrow, `deliverFor` after. This mirrors how two independent agents actually
 * interact over CAP.
 */
export abstract class SellerAgent extends Agent {
  /** Domain work: brief -> delivered artifact (text). Override per specialist. */
  abstract produce(terms: OrderTerms): Promise<string> | string;

  /** Accept the proposed terms (Negotiate phase, before the buyer Locks). */
  async acceptOrder(orderId: string): Promise<void> {
    await this.cap.accept(orderId, this.did);
  }

  /** Produce the artifact for a (already locked) order and submit its proof. */
  async deliverFor(orderId: string): Promise<DeliveryProof> {
    const order = await this.cap.getOrder(orderId);
    if (!order) throw new Error(`seller ${this.name}: unknown order ${orderId}`);
    const artifact = await this.produce(order.terms);
    const proof = makeProof(artifact, {
      attestation: `signed:${this.did}`,
    });
    await this.cap.deliver(orderId, this.did, proof);
    return proof;
  }
}
