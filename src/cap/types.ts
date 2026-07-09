/**
 * CAP (CROO Agent Protocol) — protocol-level types.
 *
 * These mirror CAP's *documented* model as pulled from cap.croo.network and
 * docs.croo.network (July 2026):
 *
 *   - CAP is the "contract layer only. Execution stays in your chosen runtime."
 *   - It sits at L3 of a 4-layer stack:
 *       L1  Identity & Reputation   (ERC-8004 DID + reputation vault)
 *       L2  Discovery & Capability  (agent cards / capability index)
 *       L3  CAP                      (order + escrow + settlement)  <-- this file
 *       L4  Execution / Hosting      (your agent's runtime)
 *   - Every order moves through four phases:
 *       Negotiate -> Lock -> Deliver -> Clear
 *   - Settlement rule: "No proof, no payment. Delivery must be verified
 *     before settlement runs." Payment is escrowed at Lock and released at
 *     Clear, conditioned on a submitted delivery proof.
 *   - Money is USDC on Base (chain 8453).
 *
 * Nothing here is CROO-proprietary; it is a faithful re-expression of the
 * public protocol description so DreamWeave can target CAP directly and swap
 * in the official SDK/contracts behind a single adapter (see cap/adapter.ts).
 */

/** ERC-8004 style decentralized identifier for an agent. */
export type AgentDID = `did:erc8004:${string}`;

/** USDC amount, expressed in base units (6 decimals) to stay integer-safe. */
export type UsdcAmount = bigint;

/** The four canonical phases of a CAP order. */
export enum OrderPhase {
  /** Terms proposed, not yet funded. */
  Negotiate = "negotiate",
  /** Buyer funds escrow; terms are locked. */
  Lock = "lock",
  /** Seller has submitted a delivery + proof, awaiting verification. */
  Deliver = "deliver",
  /** Proof verified, escrow released to seller. Terminal (success). */
  Clear = "clear",
  /** Terminal failure: rejected in negotiation, or refunded after a failed
   *  delivery / expiry. Escrow (if any) returns to the buyer. */
  Void = "void",
}

/** A capability an agent advertises on L2 (discovery). */
export interface Capability {
  /** Stable machine id, e.g. "copywriting.headline". */
  id: string;
  /** Human label. */
  title: string;
  /** Fixed price in USDC base units for one unit of this service. */
  priceUsdc: UsdcAmount;
  /** Free-form tags used by discovery/matching. */
  tags: string[];
}

/** An agent's public record: identity (L1) + capabilities (L2). */
export interface AgentCard {
  did: AgentDID;
  name: string;
  /** Wallet that receives settlement (on Base). */
  payoutAddress: string;
  capabilities: Capability[];
  /** Reputation score (0-100), sourced from L1 vault / prior orders. */
  reputation: number;
}

/** Terms proposed during Negotiate. */
export interface OrderTerms {
  capabilityId: string;
  /** The concrete request payload the seller must fulfil. */
  brief: string;
  priceUsdc: UsdcAmount;
  /** Unix ms by which delivery must occur, else the order can be Voided. */
  deadline: number;
}

/** Proof a seller submits at Deliver. CAP "verifies auth and proof only." */
export interface DeliveryProof {
  /** keccak-style content hash of the delivered artifact. */
  resultHash: string;
  /** Where the buyer can retrieve the artifact (uri, ipfs, inline, ...). */
  artifactUri: string;
  /** Optional signed attestation / logs the verifier may check. */
  attestation?: string;
}

/** A CAP order record as seen by both parties. */
export interface Order {
  id: string;
  buyer: AgentDID;
  seller: AgentDID;
  terms: OrderTerms;
  phase: OrderPhase;
  /** True once the seller has accepted the proposed terms (required before Lock). */
  accepted: boolean;
  /** Set once Locked. */
  escrowedUsdc: UsdcAmount;
  /** Set once Delivered. */
  proof?: DeliveryProof;
  /** Settlement tx reference (chain tx hash in onchain mode, synthetic in sim). */
  settlementRef?: string;
  createdAt: number;
  updatedAt: number;
}

/** Predicate a buyer supplies to verify a delivery before Clear. */
export type ProofVerifier = (order: Order, proof: DeliveryProof) => boolean;
