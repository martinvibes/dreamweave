/**
 * Server configuration — every knob comes from the environment so the same
 * build runs locally, on Railway, and in CI. Nothing here is secret at rest;
 * secrets arrive via env vars only.
 */

import { fileURLToPath } from "node:url";

// Load repo-root .env if present (real env vars always win). Node built-in.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  /* no .env file — prod supplies real env vars */
}

function env(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    return "";
  }
  return v;
}

function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export const config = {
  port: Number(env("PORT", "8787")),
  publicWebOrigin: env("WEB_ORIGIN", "*"),

  // --- database ---
  // Railway injects DATABASE_URL (Postgres). If absent, we boot an in-memory
  // Postgres (pg-mem) so local dev and tests run the SAME SQL with no server.
  databaseUrl: env("DATABASE_URL"),

  // --- LLM (provider-agnostic, OpenAI-compatible Chat Completions) ---
  // Works with 0G Private Computer (pc.0g.ai), OpenAI, OpenRouter, etc.
  llm: {
    baseUrl: env("LLM_BASE_URL", "https://api.0g.ai/v1"),
    apiKey: env("LLM_API_KEY"),
    model: env("LLM_MODEL", "deepseek-v4-flash"),
    // The Weaver's dream planner benefits from an agentic decomposition model.
    plannerModel: env("LLM_PLANNER_MODEL", env("LLM_MODEL", "glm-5.2")),
    // 0G PC returns a TEE inference proof; when true we attach it to deliveries.
    teeProofs: bool("LLM_TEE_PROOFS", false),
    // 0G-specific: some deployments expose a proof/verification endpoint.
    teeProofHeader: env("LLM_TEE_PROOF_HEADER", "x-0g-tee-proof"),
  },

  // --- Privy auth ---
  privy: {
    appId: env("PRIVY_APP_ID", "cmrb1gi9b000r0cjly6tupaz7"),
    // Used to verify Privy access tokens server-side (JWKS).
    jwksUrl: env(
      "PRIVY_JWKS_URL",
      `https://auth.privy.io/api/v1/apps/${env("PRIVY_APP_ID", "cmrb1gi9b000r0cjly6tupaz7")}/jwks.json`,
    ),
    issuer: env("PRIVY_ISSUER", "privy.io"),
    // If empty, auth runs in permissive dev mode (documented, never in prod).
    verifyTokens: bool("PRIVY_VERIFY", false),
  },

  // --- CROO (real store) ---
  croo: {
    apiUrl: env("CROO_API_URL", "https://api.croo.network"),
    wsUrl: env("CROO_WS_URL", "wss://api.croo.network/ws"),
    sdkKey: env("CROO_SDK_KEY"),
    agentId: env("CROO_AGENT_ID"),
    // Live mode: real store, real USDC. Off = local sim (dev).
    get live() {
      return Boolean(this.sdkKey);
    },
  },

  // --- chain (Base) ---
  // Settlement happens on CROO's rails (USDC on Base mainnet via CAP orders).
  // These values are only used to read/display wallet USDC balances.
  chain: {
    // 8453 = Base mainnet, 84532 = Base Sepolia.
    id: Number(env("CHAIN_ID", "8453")),
    rpcUrl: env("BASE_RPC_URL", "https://mainnet.base.org"),
    usdc: env("USDC_ADDRESS", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
  },
} as const;

export type Config = typeof config;
