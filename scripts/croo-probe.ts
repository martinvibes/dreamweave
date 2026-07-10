/**
 * Proves the SDK key works: lists our orders (empty list = success).
 *
 * REALITY NOTES (recorded from live probe, 2026-07-10):
 * - REST base path is /backend/v1/ (e.g. GET /backend/v1/orders).
 * - listOrders/listNegotiations REQUIRE role: "buyer" | "provider".
 * - EventType values (wire names): order_negotiation_created,
 *   order_negotiation_rejected, order_negotiation_expired, order_created,
 *   order_paid, order_completed, order_rejected, order_expired.
 */
import { AgentClient, EventType } from "@croo-network/sdk";
import { config } from "../server/src/config.js";

async function main() {
  if (!config.croo.live) throw new Error("CROO_SDK_KEY missing in .env");
  const client = new AgentClient(
    { baseURL: config.croo.apiUrl, wsURL: config.croo.wsUrl },
    config.croo.sdkKey,
  );
  console.log("EventType members:", JSON.stringify(EventType, null, 2));
  const orders = await client.listOrders({ role: "provider", page: 1, pageSize: 5 });
  console.log("auth OK — provider orders:", JSON.stringify(orders, null, 2));
  const negs = await client.listNegotiations({ role: "provider", page: 1, pageSize: 5 });
  console.log("negotiations:", JSON.stringify(negs, null, 2));
}
main().catch((e) => {
  console.error("PROBE FAILED:", e);
  process.exit(1);
});
