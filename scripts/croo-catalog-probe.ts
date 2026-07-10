/**
 * Discovers how to search the store programmatically. The 0.2.1 SDK has no
 * discovery API; SDK 0.1.0 exposed /agents and /services. This probes
 * candidate endpoints and prints which return JSON.
 *
 * FINDINGS (live probe, 2026-07-10) — public endpoints, NO AUTH required:
 *   GET /backend/v1/public/services?page=1&page_size=N
 *     → { items: [{ serviceId, agentId, name, description, price("100000"=0.10 USDC 6dp),
 *          slaMinutes, orders7d, feeConfig }] }
 *   GET /backend/v1/public/search?q=<text>&page=1&page_size=N
 *     → { agents: [{ agentId, name, subtitle, minServicePrice, avatar }] }
 *   GET /backend/v1/public/agents?page=1&page_size=N
 *     → { agents: [{ agentId, name, description, status, onlineStatus,
 *          completedOrders, skillTagSlugs, … }] }
 *   Also available: /public/trending-agents, /public/tags, /public/platform-stats,
 *   /public/leaderboard, /public/live-feed, /public/popular-services.
 *   Authed (dashboard JWT, not SDK key): /backend/v1/me/agents — 401 with X-SDK-Key.
 */
import { config } from "../server/src/config.js";

const candidates = [
  "/agents",
  "/services",
  "/backend/v1/agents",
  "/backend/v1/services",
  "/backend/v1/store/agents",
  "/backend/v1/store/services",
  "/backend/v1/marketplace/services",
  "/api/agents",
  "/api/services",
  "/api/v1/agents",
  "/api/v1/services",
];

async function main() {
  for (const path of candidates) {
    const url = `${config.croo.apiUrl}${path}?page=1&page_size=3`;
    try {
      const res = await fetch(url, {
        headers: { "X-SDK-Key": config.croo.sdkKey, accept: "application/json" },
      });
      const text = await res.text();
      const isJson = text.trimStart().startsWith("{") || text.trimStart().startsWith("[");
      console.log(`${res.status} ${isJson ? "JSON" : "not-json"}  ${path}`);
      if (res.ok && isJson) console.log(`  sample: ${text.slice(0, 400)}\n`);
    } catch (e) {
      console.log(`ERR ${path}: ${(e as Error).message}`);
    }
  }
}
main();
