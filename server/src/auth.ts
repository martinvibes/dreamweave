/**
 * Auth — resolve the calling user from a Privy access token.
 *
 * Production (PRIVY_VERIFY=1): verifies the Privy JWT against the app's public
 * JWKS with `jose`; the user id is the token subject (Privy DID).
 *
 * Local dev (PRIVY_VERIFY=0, default): trusts an `x-user-id` header (or falls
 * back to an anonymous demo user) so the whole flow runs without a live Privy
 * session. This fallback is explicit and never active when PRIVY_VERIFY=1.
 */

import type { IncomingMessage } from "node:http";
import { config } from "./config.js";

export interface AuthUser {
  id: string; // privy DID (prod) or dev id
  wallet?: string;
}

let jwks: ReturnType<typeof lazyJwks> | null = null;
function lazyJwks() {
  // Created on first use to avoid importing jose in pure-local runs.
  return import("jose").then(({ createRemoteJWKSet }) =>
    createRemoteJWKSet(new URL(config.privy.jwksUrl)),
  );
}

function bearer(req: IncomingMessage): string | undefined {
  const h = req.headers["authorization"];
  if (!h) return undefined;
  const m = Array.isArray(h) ? h[0] : h;
  return m?.startsWith("Bearer ") ? m.slice(7) : undefined;
}

export async function resolveUser(req: IncomingMessage): Promise<AuthUser | null> {
  if (config.privy.verifyTokens) {
    const token = bearer(req);
    if (!token) return null;
    try {
      const { jwtVerify } = await import("jose");
      if (!jwks) jwks = lazyJwks();
      const keySet = await jwks;
      const { payload } = await jwtVerify(token, keySet, {
        issuer: config.privy.issuer,
        audience: config.privy.appId,
      });
      if (!payload.sub) return null;
      return { id: payload.sub };
    } catch {
      return null;
    }
  }

  // dev fallback
  const dev = req.headers["x-user-id"];
  const id = (Array.isArray(dev) ? dev[0] : dev) || "did:demo:local-user";
  const walletHeader = req.headers["x-wallet"];
  const wallet = Array.isArray(walletHeader) ? walletHeader[0] : walletHeader;
  return { id, wallet };
}
