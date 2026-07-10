/**
 * Verifies every CROO_VESSELS key: authenticates (listOrders) and opens the
 * provider WebSocket for a moment. No orders are placed; no money moves.
 */
import { AgentClient } from "@croo-network/sdk";
import { config } from "../server/src/config.js";

interface Vessel {
  sdkKey: string;
  agentId: string;
  serviceId: string;
}

const vessels = JSON.parse(process.env.CROO_VESSELS ?? "[]") as Vessel[];
if (vessels.length === 0) throw new Error("CROO_VESSELS is empty");

for (const v of vessels) {
  const client = new AgentClient(
    { baseURL: config.croo.apiUrl, wsURL: config.croo.wsUrl },
    v.sdkKey,
  );
  try {
    await client.listOrders({ role: "provider", page: 1, pageSize: 1 });
    const stream = await client.connectWebSocket();
    await new Promise((r) => setTimeout(r, 1500));
    stream.close();
    console.log(`✅ ${v.agentId.slice(0, 8)}… auth + WS OK (service ${v.serviceId.slice(0, 8)}…)`);
  } catch (e) {
    console.log(`❌ ${v.agentId.slice(0, 8)}… FAILED: ${(e as Error).message}`);
  }
}
process.exit(0);
