/**
 * Server configuration — every knob comes from the environment so the same
 * build runs locally, on Railway, and in CI. Nothing here is secret at rest;
 * secrets arrive via env vars only.
 */

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

  // --- chain (Base) ---
  chain: {
    // 84532 = Base Sepolia (default), 8453 = Base mainnet.
    id: Number(env("CHAIN_ID", "84532")),
    rpcUrl: env("BASE_RPC_URL", "https://sepolia.base.org"),
    usdc: env("USDC_ADDRESS", "0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
    dreamVault: env("DREAMVAULT_ADDRESS"),
    // Operator key the server uses to submit settlement txs (if server-settled).
    operatorKey: env("OPERATOR_PRIVATE_KEY"),
    // When false, the engine runs settlement in-process (dev) instead of on-chain.
    onchain: bool("SETTLE_ONCHAIN", false),
  },
} as const;

export type Config = typeof config;
