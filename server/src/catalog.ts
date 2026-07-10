/**
 * Capability catalog — decides WHO does a subtask.
 *
 *   store   : a real third-party service on the CROO store (preferred, live)
 *   local   : an agent in our own DB (sim mode, or platform agents)
 *   missing : nobody — the Foundry's cue to birth a new agent
 *
 * Resolution order in live mode:
 *   1. CROO_CATALOG env JSON — hand-vetted capability→service pins:
 *      [{"capabilityId":"research.market","serviceId":"…","name":"…","priceUsdc":"0.50"}]
 *   2. Live store search over the public API (no auth):
 *      GET /backend/v1/public/services — keyword-matched, affordability-capped,
 *      busiest-first, never our own agent, never fund-transfer services.
 *   3. Local DB agent.
 *   4. missing.
 * Local mode: 3 → 4 only. CROO_STORE_SEARCH=off disables step 2 (tests).
 */

import { usdc } from "../../src/index.js";
import { bestAgentFor, type AgentRow } from "./repo.js";
import { config } from "./config.js";

export type Resolution =
  | { kind: "store"; serviceId: string; name: string; priceUsdc: bigint }
  | { kind: "local"; agent: AgentRow }
  | { kind: "missing" };

interface CatalogEntry {
  capabilityId: string;
  serviceId: string;
  name: string;
  priceUsdc: string;
}

export interface StoreService {
  serviceId: string;
  agentId: string;
  name: string;
  description: string;
  priceUsdc: bigint;
  orders7d: number;
  fundTransfer: boolean;
}

/** Never spend more than this on a single sub-hire without a human pin. */
const MAX_AUTO_PRICE = usdc("2.00");

function envCatalog(): CatalogEntry[] {
  const raw = process.env.CROO_CATALOG;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CatalogEntry[];
  } catch {
    console.error("CROO_CATALOG is not valid JSON — ignoring");
    return [];
  }
}

let cache: { at: number; items: StoreService[] } | null = null;
const CACHE_MS = 5 * 60 * 1000;

async function fetchStoreServices(): Promise<StoreService[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;
  try {
    const res = await fetch(
      `${config.croo.apiUrl}/backend/v1/public/services?page=1&page_size=100`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`public services ${res.status}`);
    const data = (await res.json()) as {
      items?: {
        serviceId: string;
        agentId: string;
        name: string;
        description: string;
        price: string;
        orders7d?: string;
        feeConfig?: string;
      }[];
    };
    const items: StoreService[] = (data.items ?? []).map((s) => {
      let fundTransfer = false;
      try {
        fundTransfer = Boolean(
          (JSON.parse(s.feeConfig ?? "{}") as { fund_transfer_required?: boolean })
            .fund_transfer_required,
        );
      } catch {
        /* malformed feeConfig — treat as normal */
      }
      return {
        serviceId: s.serviceId,
        agentId: s.agentId,
        name: s.name,
        description: s.description ?? "",
        priceUsdc: BigInt(s.price ?? "0"),
        orders7d: Number(s.orders7d ?? "0"),
        fundTransfer,
      };
    });
    cache = { at: Date.now(), items };
    return items;
  } catch (e) {
    console.error("store search unavailable:", (e as Error).message);
    return [];
  }
}

/** Pure matcher — exported for tests. */
export function _matchService(
  items: StoreService[],
  capabilityId: string,
  ownAgentId: string,
): StoreService | undefined {
  const terms = capabilityId
    .toLowerCase()
    .split(/[._\-\s]+/)
    .filter((t) => t.length > 2);
  const scored = items
    .filter(
      (s) =>
        !s.fundTransfer &&
        s.agentId !== ownAgentId &&
        s.priceUsdc > 0n &&
        s.priceUsdc <= MAX_AUTO_PRICE,
    )
    .map((s) => {
      const hay = `${s.name} ${s.description}`.toLowerCase();
      const score = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.s.orders7d - a.s.orders7d);
  return scored[0]?.s;
}

export async function resolveCapability(capabilityId: string): Promise<Resolution> {
  if (config.croo.live) {
    const pin = envCatalog().find((e) => e.capabilityId === capabilityId);
    if (pin) {
      return {
        kind: "store",
        serviceId: pin.serviceId,
        name: pin.name,
        priceUsdc: usdc(pin.priceUsdc),
      };
    }
    if (process.env.CROO_STORE_SEARCH !== "off") {
      const hit = _matchService(
        await fetchStoreServices(),
        capabilityId,
        config.croo.agentId,
      );
      if (hit) {
        return {
          kind: "store",
          serviceId: hit.serviceId,
          name: hit.name,
          priceUsdc: hit.priceUsdc,
        };
      }
    }
  }
  const agent = await bestAgentFor(capabilityId);
  if (agent) return { kind: "local", agent };
  return { kind: "missing" };
}
