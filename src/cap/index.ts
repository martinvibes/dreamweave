/**
 * Backend factory — chooses the CapClient implementation from env.
 *
 *   DREAMWEAVE_BACKEND=sim      (default) -> SimCapClient
 *   DREAMWEAVE_BACKEND=onchain            -> OnchainCapClient (needs addresses)
 */

import type { CapClient } from "./client.js";
import { SimCapClient, type SimOptions } from "./sim.js";
import { OnchainCapClient, type OnchainConfig } from "./onchain.js";

export type Backend = "sim" | "onchain";

export function backendFromEnv(env = process.env): Backend {
  const b = (env.DREAMWEAVE_BACKEND ?? "sim").toLowerCase();
  if (b === "onchain") return "onchain";
  return "sim";
}

export function createCapClient(
  env = process.env,
  simOpts: SimOptions = {},
): CapClient {
  if (backendFromEnv(env) === "onchain") {
    const cfg: OnchainConfig = {
      rpcUrl: req(env, "BASE_RPC_URL"),
      chainId: Number(env.CHAIN_ID ?? "8453"),
      usdcAddress: req(env, "USDC_ADDRESS") as `0x${string}`,
      capRegistryAddress: req(env, "CAP_REGISTRY_ADDRESS") as `0x${string}`,
      capEscrowAddress: req(env, "CAP_ESCROW_ADDRESS") as `0x${string}`,
      privateKey: req(env, "AGENT_PRIVATE_KEY") as `0x${string}`,
    };
    return new OnchainCapClient(cfg);
  }
  return new SimCapClient(simOpts);
}

function req(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key];
  if (!v) {
    throw new Error(
      `onchain backend requires ${key}; set it in .env or use DREAMWEAVE_BACKEND=sim`,
    );
  }
  return v;
}
