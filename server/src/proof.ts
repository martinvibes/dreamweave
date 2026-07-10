/**
 * Public proof snapshot — the numbers that make judges believe.
 *
 * Pulls REAL orders from CROO (both directions: jobs DreamWeave sold, agents
 * it hired — plus every vessel/child's sold orders), then folds in births,
 * royalties, and proof roots from the DB. Cached briefly; no auth required.
 */

import { formatUsdc } from "../../src/index.js";
import { makeClient } from "./croo.js";
import { config } from "./config.js";
import { getDb } from "./db.js";
import { listAgents, listRoyalties } from "./repo.js";

export interface ProofOrder {
  orderId: string;
  role: "sold" | "hired";
  agent: string; // which of ours was involved
  counterpartyAgentId: string;
  buyerWallet: string | null;
  priceUsdc: string;
  status: string;
  payTxHash: string | null;
  updatedTime: string;
}

export interface ProofSnapshot {
  live: boolean;
  totals: {
    orders: number;
    completed: number;
    uniqueCounterparties: number;
    uniqueBuyerWallets: number;
    agentsBorn: number;
    royaltiesUsdc: string;
  };
  orders: ProofOrder[];
  births: { name: string; capabilityId: string; storeUrl: string | null }[];
  roots: { dreamId: string; root: string; leaves: number }[];
}

interface RawOrder {
  orderId?: string;
  requesterAgentId?: string;
  providerAgentId?: string;
  requesterWalletAddress?: string;
  buyerUserId?: string;
  price?: string;
  amount?: string;
  status?: string;
  payTxHash?: string;
  updatedTime?: string;
}

/** List responses carry amount ("50000.00000000", 6dp units); detail has price. */
function orderUnits(o: RawOrder): bigint {
  const raw = o.price || o.amount || "0";
  const n = Number(raw);
  return Number.isFinite(n) ? BigInt(Math.round(n)) : 0n;
}

interface VesselCfg {
  sdkKey: string;
  agentId: string;
  serviceId: string;
}

let cache: { at: number; snap: ProofSnapshot } | null = null;
const CACHE_MS = 30_000;

async function fetchOrders(
  sdkKey: string,
  role: "provider" | "buyer",
): Promise<RawOrder[]> {
  try {
    const client = makeClient(sdkKey);
    const res = (await client.listOrders({
      role,
      page: 1,
      pageSize: 100,
    } as never)) as unknown;
    if (Array.isArray(res)) return res as RawOrder[];
    const items = (res as { items?: RawOrder[]; orders?: RawOrder[] });
    return items.items ?? items.orders ?? [];
  } catch (e) {
    console.error(`proof: listOrders(${role}) failed:`, (e as Error).message);
    return [];
  }
}

export async function getProofSnapshot(): Promise<ProofSnapshot> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.snap;

  const agents = await listAgents();
  const born = agents.filter((a) => a.parentId === "foundry");
  const royalties = await listRoyalties();
  const royaltyTotal = royalties.reduce((s, r) => s + r.amountUsdc, 0n);

  const nameByServiceId = new Map(
    born.filter((a) => a.crooServiceId).map((a) => [a.crooServiceId!, a.name]),
  );

  const orders: ProofOrder[] = [];

  if (config.croo.live) {
    const vessels: VesselCfg[] = (() => {
      try {
        return JSON.parse(process.env.CROO_VESSELS ?? "[]") as VesselCfg[];
      } catch {
        return [];
      }
    })();

    const jobs: { key: string; role: "provider" | "buyer"; agent: string }[] = [
      { key: config.croo.sdkKey, role: "provider", agent: "DreamWeave" },
      { key: config.croo.sdkKey, role: "buyer", agent: "DreamWeave" },
      ...vessels.map((v) => ({
        key: v.sdkKey,
        role: "provider" as const,
        agent: nameByServiceId.get(v.serviceId) ?? "vessel",
      })),
    ];

    const results = await Promise.all(jobs.map((j) => fetchOrders(j.key, j.role)));
    results.forEach((raws, i) => {
      const j = jobs[i]!;
      for (const o of raws) {
        orders.push({
          orderId: o.orderId ?? "",
          role: j.role === "provider" ? "sold" : "hired",
          agent: j.agent,
          counterpartyAgentId:
            (j.role === "provider" ? o.requesterAgentId : o.providerAgentId) ?? "",
          buyerWallet:
            j.role === "provider"
              ? o.requesterWalletAddress || o.buyerUserId || null
              : null,
          priceUsdc: formatUsdc(orderUnits(o)),
          status: o.status ?? "",
          payTxHash: o.payTxHash || null,
          updatedTime: o.updatedTime ?? "",
        });
      }
    });
    orders.sort((a, b) => (a.updatedTime < b.updatedTime ? 1 : -1));
  }

  const completed = orders.filter((o) =>
    ["completed", "cleared", "clearing"].includes(o.status),
  ).length;
  const counterparties = new Set(
    orders.map((o) => o.counterpartyAgentId).filter(Boolean),
  );
  const buyerWallets = new Set(
    orders.map((o) => o.buyerWallet).filter(Boolean) as string[],
  );

  const db = await getDb();
  const { rows } = await db.query(
    `SELECT id, prooftree_root, prooftree_leaves FROM dreams
     WHERE prooftree_root IS NOT NULL ORDER BY updated_at DESC LIMIT 12`,
  );
  const roots = rows.map((r: Record<string, unknown>) => ({
    dreamId: String(r.id),
    root: String(r.prooftree_root),
    leaves: (() => {
      try {
        return (JSON.parse(String(r.prooftree_leaves ?? "[]")) as unknown[]).length;
      } catch {
        return 0;
      }
    })(),
  }));

  const snap: ProofSnapshot = {
    live: config.croo.live,
    totals: {
      orders: orders.length,
      completed,
      uniqueCounterparties: counterparties.size,
      uniqueBuyerWallets: buyerWallets.size,
      agentsBorn: born.length,
      royaltiesUsdc: formatUsdc(royaltyTotal),
    },
    orders: orders.slice(0, 40),
    births: born.map((a) => ({
      name: a.name,
      capabilityId: a.capabilityId,
      storeUrl: a.crooServiceId
        ? `https://agent.croo.network/agents/${a.crooServiceId}`
        : null,
    })),
    roots,
  };
  cache = { at: Date.now(), snap };
  return snap;
}
