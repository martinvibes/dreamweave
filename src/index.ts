/**
 * DreamWeave public API.
 *
 * DreamWeave is agentic-commerce infrastructure built natively on the CROO
 * Agent Protocol (CAP): agents discover, hire, and pay each other on-chain
 * through CAP's Negotiate -> Lock -> Deliver -> Clear escrow lifecycle.
 */

// CAP protocol layer
export * from "./cap/types.js";
export type { CapClient } from "./cap/client.js";
export { SimCapClient, CapError, type SimOptions } from "./cap/sim.js";
export { OnchainCapClient, type OnchainConfig } from "./cap/onchain.js";
export { createCapClient, backendFromEnv, type Backend } from "./cap/index.js";
export {
  hashArtifact,
  makeProof,
  expectArtifactHash,
  verifyInlineArtifact,
} from "./cap/proof.js";

// Agents
export { Agent, SellerAgent, type AgentInit } from "./agents/agent.js";
export {
  WeaverAgent,
  type WeaveReport,
  type HireResult,
  type Logger,
  type SellerDriver,
} from "./agents/weaver.js";
export {
  specialistRoster,
  localSellerDriver,
  ResearcherAgent,
  CopywriterAgent,
  DesignerAgent,
  DistributorAgent,
} from "./agents/specialists.js";

// Planning + money
export { planDream, type Dream, type Subtask } from "./dream.js";
export { usdc, formatUsdc } from "./util/money.js";
