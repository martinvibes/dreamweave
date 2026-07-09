/**
 * OnchainCapClient — Base-mainnet backing for the CapClient interface.
 *
 * STATUS: skeleton, intentionally not wired to live contracts.
 *
 * As of research (July 2026) CROO has NOT published concrete CAP contract
 * addresses or a stable SDK package (`agent.croo.network` shows 0 agents / 0
 * orders, and the docs reference a "CAP SDK quickstart" without a public
 * package name; there is also naming drift with an earlier "CROO Connect SDK").
 * Rather than guess and ship a broken integration (a hackathon hard-DQ), this
 * file documents EXACTLY where the real calls plug in, so swapping to on-chain
 * is a contained, reviewable change once addresses are available.
 *
 * The mapping is 1:1 with CAP's four phases:
 *   lock     -> approve+deposit USDC into the CAP escrow contract
 *   deliver  -> seller submits resultHash on-chain (Deliver event)
 *   clear    -> buyer calls settle(); escrow releases USDC to seller
 *   void     -> refund() path
 *
 * viem is an optionalDependency; this module only imports it lazily so the sim
 * demo/tests run with zero external deps installed.
 */

import type { CapClient } from "./client.js";
import type {
  AgentCard,
  AgentDID,
  DeliveryProof,
  Order,
  OrderTerms,
  ProofVerifier,
} from "./types.js";

export interface OnchainConfig {
  rpcUrl: string;
  chainId: number; // 8453 = Base mainnet
  usdcAddress: `0x${string}`;
  capRegistryAddress: `0x${string}`;
  capEscrowAddress: `0x${string}`;
  /** Operator key that signs this agent's CAP transactions. */
  privateKey: `0x${string}`;
}

const NOT_WIRED =
  "OnchainCapClient is a documented skeleton. Provide CAP contract addresses " +
  "from docs.croo.network and implement the marked TODOs, then set " +
  "DREAMWEAVE_BACKEND=onchain. Until then use the `sim` backend.";

export class OnchainCapClient implements CapClient {
  constructor(private readonly cfg: OnchainConfig) {}

  /** Exposes the resolved config (chain id, addresses) for diagnostics/logging. */
  get config(): Readonly<OnchainConfig> {
    return this.cfg;
  }

  /**
   * Where viem gets initialised once addresses exist:
   *
   *   const { createWalletClient, createPublicClient, http } = await import("viem");
   *   const { privateKeyToAccount } = await import("viem/accounts");
   *   const { base } = await import("viem/chains");
   *   this.account = privateKeyToAccount(this.cfg.privateKey);
   *   this.wallet  = createWalletClient({ account, chain: base, transport: http(rpcUrl) });
   *   this.public  = createPublicClient({ chain: base, transport: http(rpcUrl) });
   */

  async register(_card: AgentCard): Promise<AgentCard> {
    // TODO: mint/attest ERC-8004 identity via CAP registry, publish agent card.
    throw new Error(NOT_WIRED);
  }
  async discover(): Promise<AgentCard[]> {
    // TODO: query L2 discovery index (CAP registry read / subgraph).
    throw new Error(NOT_WIRED);
  }
  async getAgent(_did: AgentDID): Promise<AgentCard | undefined> {
    throw new Error(NOT_WIRED);
  }
  async negotiate(
    _buyer: AgentDID,
    _seller: AgentDID,
    _terms: OrderTerms,
  ): Promise<Order> {
    // TODO: create order (off-chain signed intent or on-chain createOrder()).
    throw new Error(NOT_WIRED);
  }
  async accept(): Promise<Order> {
    throw new Error(NOT_WIRED);
  }
  async reject(): Promise<Order> {
    throw new Error(NOT_WIRED);
  }
  async lock(): Promise<Order> {
    // TODO: usdc.approve(escrow, price); escrow.lock(orderId).
    throw new Error(NOT_WIRED);
  }
  async deliver(
    _orderId: string,
    _seller: AgentDID,
    _proof: DeliveryProof,
  ): Promise<Order> {
    // TODO: escrow.deliver(orderId, keccak256(resultHash), artifactUri).
    throw new Error(NOT_WIRED);
  }
  async clear(
    _orderId: string,
    _buyer: AgentDID,
    _verify: ProofVerifier,
  ): Promise<Order> {
    // TODO: run verify() off-chain, then escrow.settle(orderId) to release USDC.
    throw new Error(NOT_WIRED);
  }
  async void(): Promise<Order> {
    // TODO: escrow.refund(orderId).
    throw new Error(NOT_WIRED);
  }
  async getOrder(_orderId: string): Promise<Order | undefined> {
    throw new Error(NOT_WIRED);
  }
  async listOrders(): Promise<Order[]> {
    throw new Error(NOT_WIRED);
  }
}
