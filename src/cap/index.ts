/**
 * Backend factory — the in-process CAP engine used for local runs and tests.
 *
 * Production settlement happens on CROO's rails via `@croo-network/sdk`
 * (real CAP orders, USDC on Base); this sim mirrors that lifecycle locally.
 */

import type { CapClient } from "./client.js";
import { SimCapClient, type SimOptions } from "./sim.js";

export type Backend = "sim";

export function backendFromEnv(): Backend {
  return "sim";
}

export function createCapClient(
  _env = process.env,
  simOpts: SimOptions = {},
): CapClient {
  return new SimCapClient(simOpts);
}
