/**
 * USDC balance reads on Base via plain JSON-RPC (no client library).
 * Used only to show a wallet's USDC balance in the dashboard.
 */

import { config } from "./config.js";

// balanceOf(address) selector
const BALANCE_OF = "0x70a08231";

export async function usdcBalanceOf(address: string): Promise<bigint> {
  const addr = address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const res = await fetch(config.chain.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: config.chain.usdc, data: BALANCE_OF + addr }, "latest"],
    }),
  });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const json = (await res.json()) as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return BigInt(json.result ?? "0x0");
}
