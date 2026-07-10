# DreamWeave Genesis Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewire DreamWeave onto the real CROO network — the Weaver sells `Fulfil an Outcome` on the store, hires real third-party agents as subcontractors, births new agents via the Foundry when a skill is missing, and ships every delivery with a composed proof tree.

**Architecture:** One Railway/local Node process hosts all our agents. `croo.ts` wraps `@croo-network/sdk` for both roles (provider loop + requester hire). The existing orchestrator keeps its planner/0G/SSE spine; per subtask it now dispatches to store-hire, foundry-birth, or the local sim (dev mode). Proof leaves accumulate per subtask into a root hash delivered inside the final CAP delivery.

**Tech Stack:** Node 20+, tsx, TypeScript, `@croo-network/sdk@^0.2.1` (only new dependency), pg/pg-mem, node:test.

## Global Constraints

- MIT license; never commit `.env` (already gitignored — CROO creds live there).
- Live mode is enabled iff `CROO_SDK_KEY` is set; every feature must still work in local mode (sim engine) with no CROO creds.
- No new dependencies beyond `@croo-network/sdk`.
- USDC amounts are `bigint` with 6 decimals throughout (`usdc()` / `formatUsdc()` helpers from `src/util/money.ts`).
- All server files use ESM imports with `.js` extensions (existing convention).
- Run `npm run typecheck` before every commit.
- The UI is a separate plan (`2026-07-11-loom-ui.md`, written after this engine lands); this plan only *emits* the events the UI will consume.

**Prerequisites already in `.env`:** `CROO_API_URL`, `CROO_WS_URL`, `CROO_SDK_KEY`, `CROO_AGENT_ID`. Pending user actions: fund agent wallet with USDC on Base; register 3–5 vessel agents (each with one generic service) and add them as `CROO_VESSELS` (Task 7).

---

### Task 1: SDK install, croo config, connectivity probe

**Files:**
- Modify: `package.json` (dependency)
- Modify: `server/src/config.ts` (croo section)
- Create: `scripts/croo-probe.ts`

**Interfaces:**
- Produces: `config.croo = { apiUrl: string; wsUrl: string; sdkKey: string; agentId: string; live: boolean }` — every later task reads `config.croo.live` to gate live behavior.

- [ ] **Step 1: Install the SDK**

```bash
npm install @croo-network/sdk@^0.2.1
```

- [ ] **Step 2: Add the croo section to config**

In `server/src/config.ts`, after the `chain` section, add:

```ts
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
```

Note: `env(name)` already exists in this file and returns `""` for unset vars — check its exact signature before use; if it returns `string | undefined`, coerce with `?? ""`.

- [ ] **Step 3: Write the connectivity probe**

Create `scripts/croo-probe.ts`:

```ts
/** Proves the SDK key works: lists our orders (empty list = success). */
import { AgentClient } from "@croo-network/sdk";
import { config } from "../server/src/config.js";

async function main() {
  if (!config.croo.live) throw new Error("CROO_SDK_KEY missing in .env");
  const client = new AgentClient(
    { baseURL: config.croo.apiUrl, wsURL: config.croo.wsUrl },
    config.croo.sdkKey,
  );
  const orders = await client.listOrders({ page: 1, pageSize: 5 });
  console.log("auth OK — orders:", JSON.stringify(orders, null, 2));
  const negs = await client.listNegotiations({ page: 1, pageSize: 5 });
  console.log("negotiations:", JSON.stringify(negs, null, 2));
}
main().catch((e) => {
  console.error("PROBE FAILED:", e);
  process.exit(1);
});
```

- [ ] **Step 4: Run the probe**

Run: `npx tsx scripts/croo-probe.ts`
Expected: `auth OK — orders:` followed by an empty/valid list. If it 401s, the key in `.env` is wrong — stop and tell the user. If the SDK's actual response shapes differ from the README (field names, pagination), record the real shapes in a comment at the top of `scripts/croo-probe.ts` — Task 4 depends on them.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add package.json package-lock.json server/src/config.ts scripts/croo-probe.ts
git commit -m "feat: add @croo-network/sdk, croo config, connectivity probe"
```

---

### Task 2: Store catalog discovery probe

**Files:**
- Create: `scripts/croo-catalog-probe.ts`

**Interfaces:**
- Produces: knowledge only — which public endpoint lists store agents/services. Task 5 (`catalog.ts`) consumes the finding; both of its code paths (live search + env fallback) are written regardless of the outcome.

- [ ] **Step 1: Write the discovery probe**

Create `scripts/croo-catalog-probe.ts`:

```ts
/**
 * Discovers how to search the store programmatically. The 0.2.1 SDK has no
 * discovery API; SDK 0.1.0 exposed /agents and /services. This probes
 * candidate endpoints and prints which return JSON.
 */
import { config } from "../server/src/config.js";

const candidates = [
  "/agents",
  "/services",
  "/api/agents",
  "/api/services",
  "/api/v1/agents",
  "/api/v1/services",
  "/sdk/v1/agents",
  "/sdk/v1/services",
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
```

- [ ] **Step 2: Run it and record the outcome**

Run: `npx tsx scripts/croo-catalog-probe.ts`
Expected: at least a list of statuses. Record which endpoint (if any) returned agent/service JSON in a comment at the top of the script, including the response field names (service id, name, price). If none work, also try the browser: open agent.croo.network, DevTools → Network, note the XHR the store grid makes, and test that path here.

- [ ] **Step 3: Commit**

```bash
git add scripts/croo-catalog-probe.ts
git commit -m "chore: probe CROO store discovery endpoints"
```

---

### Task 3: Proof tree module (pure, TDD)

**Files:**
- Create: `server/src/prooftree.ts`
- Test: `test/prooftree.test.ts`

**Interfaces:**
- Consumes: `hashArtifact(s: string): string` from `src/index.js` (sha256 hex, `0x`-prefixed).
- Produces:
  - `interface ProofLeaf { orderId: string; serviceId: string; agent: string; role: "hired" | "born" | "local"; deliverableHash: string; payTxHash?: string; teeAttestation?: string }`
  - `leafHash(leaf: ProofLeaf): string`
  - `computeRoot(leaves: ProofLeaf[]): string` — order-independent (sorted), `"0x0"` for empty.

- [ ] **Step 1: Write the failing test**

Create `test/prooftree.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { leafHash, computeRoot, type ProofLeaf } from "../server/src/prooftree.js";

const leafA: ProofLeaf = {
  orderId: "ord-1",
  serviceId: "svc-1",
  agent: "Sage",
  role: "hired",
  deliverableHash: "0xaaa",
  payTxHash: "0xtx1",
};
const leafB: ProofLeaf = {
  orderId: "ord-2",
  serviceId: "svc-2",
  agent: "Nova",
  role: "born",
  deliverableHash: "0xbbb",
  teeAttestation: "tee-proof-xyz",
};

test("leafHash is deterministic and key-order independent", () => {
  const shuffled = {
    role: leafA.role,
    agent: leafA.agent,
    orderId: leafA.orderId,
    deliverableHash: leafA.deliverableHash,
    payTxHash: leafA.payTxHash,
    serviceId: leafA.serviceId,
  } as ProofLeaf;
  assert.equal(leafHash(leafA), leafHash(shuffled));
  assert.match(leafHash(leafA), /^0x[0-9a-f]+$/);
});

test("computeRoot is order-independent and input-sensitive", () => {
  const r1 = computeRoot([leafA, leafB]);
  const r2 = computeRoot([leafB, leafA]);
  assert.equal(r1, r2);
  assert.notEqual(r1, computeRoot([leafA]));
});

test("computeRoot of empty list is 0x0", () => {
  assert.equal(computeRoot([]), "0x0");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/prooftree.test.ts`
Expected: FAIL — cannot find module `../server/src/prooftree.js`.

- [ ] **Step 3: Implement**

Create `server/src/prooftree.ts`:

```ts
/**
 * Proof tree — one verifiable fingerprint over every sub-job in a dream.
 * Leaf = one hire (store agent, born agent, or local sim run). The root
 * ships inside the Weaver's CAP delivery; anyone can re-derive it offline.
 */

import { hashArtifact } from "../../src/index.js";

export interface ProofLeaf {
  orderId: string;
  serviceId: string;
  agent: string;
  role: "hired" | "born" | "local";
  deliverableHash: string;
  payTxHash?: string;
  teeAttestation?: string;
}

/** Canonical JSON: fixed key order so hashes are stable. */
function canonical(leaf: ProofLeaf): string {
  return JSON.stringify({
    orderId: leaf.orderId,
    serviceId: leaf.serviceId,
    agent: leaf.agent,
    role: leaf.role,
    deliverableHash: leaf.deliverableHash,
    payTxHash: leaf.payTxHash ?? null,
    teeAttestation: leaf.teeAttestation ?? null,
  });
}

export function leafHash(leaf: ProofLeaf): string {
  return hashArtifact(canonical(leaf));
}

export function computeRoot(leaves: ProofLeaf[]): string {
  if (leaves.length === 0) return "0x0";
  const sorted = leaves.map(leafHash).sort();
  return hashArtifact(sorted.join("|"));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/prooftree.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add server/src/prooftree.ts test/prooftree.test.ts
git commit -m "feat: proof tree — canonical leaf hashing + order-independent root"
```

---

### Task 4: CROO gateway (`croo.ts`) — provider loop + requester hire

**Files:**
- Create: `server/src/croo.ts`
- Test: `test/croo.test.ts`

**Interfaces:**
- Consumes: `config.croo` (Task 1); `@croo-network/sdk` `AgentClient`, `EventType`, `DeliverableType`.
- Produces:
  - `interface HireResult { orderId: string; serviceId: string; deliverableText: string; payTxHash?: string }`
  - `hireService(opts: { serviceId: string; requirements: string; timeoutMs?: number; sdkKey?: string }): Promise<HireResult>` — full requester leg.
  - `startProvider(opts: { sdkKey: string; onJob: (requirements: string, orderId: string) => Promise<string> }): Promise<() => void>` — accepts negotiations, delivers `onJob`'s return string on payment; returns a stop function.
  - `makeClient(sdkKey: string): AgentClient` (exported for probes/tests).

**Design note:** WS events are per-connection and not scoped to one order, so the requester correlates by id: `negotiateOrder` → remember `negotiationId` → match `order_created` carrying that negotiation id → `payOrder` → match `order_completed` for that order id → `getDelivery`. Event payload field names (`negotiation_id`, `order_id`) come from the SDK README; verify against the real shapes recorded in Task 1's probe comment and adjust.

- [ ] **Step 1: Write the failing test**

The test injects a fake `AgentClient` — the gateway takes an optional factory for testability. Create `test/croo.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { _hireWithClient, _provideWithClient } from "../server/src/croo.js";

/** Minimal fake mirroring the AgentClient surface the gateway touches. */
function makeFake() {
  const stream = new EventEmitter() as EventEmitter & { close: () => void };
  stream.close = () => {};
  const calls: string[] = [];
  const client = {
    connectWebSocket: async () => stream,
    negotiateOrder: async (_: unknown) => {
      calls.push("negotiate");
      queueMicrotask(() =>
        stream.emit("order_created", { negotiation_id: "neg-1", order_id: "ord-1" }),
      );
      return { negotiationId: "neg-1" };
    },
    payOrder: async (id: string) => {
      calls.push(`pay:${id}`);
      queueMicrotask(() => stream.emit("order_completed", { order_id: "ord-1" }));
      return { txHash: "0xpaid" };
    },
    getDelivery: async (id: string) => {
      calls.push(`delivery:${id}`);
      return { deliverableText: "the goods" };
    },
    acceptNegotiation: async (id: string) => {
      calls.push(`accept:${id}`);
      return { order: { orderId: "ord-9" } };
    },
    deliverOrder: async (id: string, req: { deliverableText: string }) => {
      calls.push(`deliver:${id}:${req.deliverableText}`);
    },
  };
  return { client, stream, calls };
}

test("hire: negotiate → pay on order_created → getDelivery on order_completed", async () => {
  const { client, calls } = makeFake();
  const result = await _hireWithClient(client as never, {
    serviceId: "svc-1",
    requirements: "do the thing",
    timeoutMs: 2000,
  });
  assert.equal(result.orderId, "ord-1");
  assert.equal(result.deliverableText, "the goods");
  assert.equal(result.payTxHash, "0xpaid");
  assert.deepEqual(calls, ["negotiate", "pay:ord-1", "delivery:ord-1"]);
});

test("provider: accepts negotiation, runs job on order_paid, delivers", async () => {
  const { client, stream, calls } = makeFake();
  await _provideWithClient(client as never, {
    onJob: async (req) => `did: ${req}`,
  });
  stream.emit("negotiation_created", { negotiation_id: "neg-9" });
  await new Promise((r) => setTimeout(r, 10));
  stream.emit("order_paid", { order_id: "ord-9", requirements: "write docs" });
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(calls.includes("accept:neg-9"));
  assert.ok(calls.some((c) => c.startsWith("deliver:ord-9:did: write docs")));
});

test("hire: rejects on timeout", async () => {
  const { client } = makeFake();
  (client as { negotiateOrder: unknown }).negotiateOrder = async () => ({
    negotiationId: "neg-x", // no order_created will ever fire
  });
  await assert.rejects(
    _hireWithClient(client as never, {
      serviceId: "svc-1",
      requirements: "x",
      timeoutMs: 50,
    }),
    /timeout/i,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/croo.test.ts`
Expected: FAIL — cannot find module `../server/src/croo.js`.

- [ ] **Step 3: Implement**

Create `server/src/croo.ts`:

```ts
/**
 * CROO gateway — our one integration point with the real store.
 *
 * Requester leg:  hireService()  — negotiate, pay, await delivery.
 * Provider leg:   startProvider() — accept negotiations, deliver on payment.
 *
 * The SDK's WS stream emits snake_case event names; ids are correlated
 * manually (one stream carries all of an agent's orders).
 */

import { AgentClient, DeliverableType, EventType } from "@croo-network/sdk";
import { config } from "./config.js";

export interface HireResult {
  orderId: string;
  serviceId: string;
  deliverableText: string;
  payTxHash?: string;
}

export function makeClient(sdkKey: string): AgentClient {
  return new AgentClient(
    { baseURL: config.croo.apiUrl, wsURL: config.croo.wsUrl },
    sdkKey,
  );
}

interface WsEvent {
  negotiation_id?: string;
  order_id?: string;
  requirements?: string;
}

type Stream = Awaited<ReturnType<AgentClient["connectWebSocket"]>>;

function on(stream: Stream, event: string, cb: (e: WsEvent) => void): void {
  // EventType members are the snake_case strings; fall back to the raw name
  // so the injected test fake (a plain EventEmitter) works too.
  (stream as unknown as { on: (ev: string, cb: (e: WsEvent) => void) => void }).on(
    (EventType as Record<string, string>)[event] ?? event,
    cb,
  );
}

/** Internal, client-injected implementation — exported for tests. */
export async function _hireWithClient(
  client: AgentClient,
  opts: { serviceId: string; requirements: string; timeoutMs?: number },
): Promise<HireResult> {
  const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;
  const stream = await client.connectWebSocket();

  try {
    return await new Promise<HireResult>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`hire timeout after ${timeoutMs}ms (service ${opts.serviceId})`)),
        timeoutMs,
      );
      let negotiationId = "";
      let orderId = "";
      let payTxHash: string | undefined;

      on(stream, "order_created", async (e) => {
        if (e.negotiation_id !== negotiationId || !e.order_id) return;
        orderId = e.order_id;
        try {
          const paid = await client.payOrder(orderId);
          payTxHash = (paid as { txHash?: string }).txHash;
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      });

      on(stream, "order_completed", async (e) => {
        if (e.order_id !== orderId || !orderId) return;
        try {
          const d = await client.getDelivery(orderId);
          clearTimeout(timer);
          resolve({
            orderId,
            serviceId: opts.serviceId,
            deliverableText: String((d as { deliverableText?: string }).deliverableText ?? ""),
            payTxHash,
          });
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      });

      on(stream, "order_rejected", (e) => {
        if (e.order_id === orderId && orderId) reject(new Error(`order ${orderId} rejected`));
      });
      on(stream, "order_expired", (e) => {
        if (e.order_id === orderId && orderId) reject(new Error(`order ${orderId} expired (SLA)`));
      });

      client
        .negotiateOrder({ serviceId: opts.serviceId, requirements: opts.requirements })
        .then((n) => {
          negotiationId = (n as { negotiationId?: string }).negotiationId ?? "";
          if (!negotiationId) reject(new Error("negotiateOrder returned no negotiationId"));
        })
        .catch(reject);
    });
  } finally {
    stream.close();
  }
}

/** Internal, client-injected provider loop — exported for tests. */
export async function _provideWithClient(
  client: AgentClient,
  opts: { onJob: (requirements: string, orderId: string) => Promise<string> },
): Promise<() => void> {
  const stream = await client.connectWebSocket();

  on(stream, "negotiation_created", async (e) => {
    if (!e.negotiation_id) return;
    try {
      await client.acceptNegotiation(e.negotiation_id);
    } catch (err) {
      console.error("acceptNegotiation failed:", err);
    }
  });

  on(stream, "order_paid", async (e) => {
    if (!e.order_id) return;
    try {
      // Requirements may ride on the event; if absent, fetch the order.
      let requirements = e.requirements ?? "";
      if (!requirements) {
        const order = await client.getOrder(e.order_id);
        requirements = String((order as { requirements?: string }).requirements ?? "");
      }
      const text = await opts.onJob(requirements, e.order_id);
      await client.deliverOrder(e.order_id, {
        deliverableType: DeliverableType.Text,
        deliverableText: text,
      });
    } catch (err) {
      console.error(`job for order ${e.order_id} failed:`, err);
      try {
        await client.rejectOrder(e.order_id, "internal error while fulfilling order");
      } catch { /* already logged */ }
    }
  });

  return () => stream.close();
}

/** Public API — real clients from config/env keys. */
export async function hireService(opts: {
  serviceId: string;
  requirements: string;
  timeoutMs?: number;
  sdkKey?: string;
}): Promise<HireResult> {
  return _hireWithClient(makeClient(opts.sdkKey ?? config.croo.sdkKey), opts);
}

export async function startProvider(opts: {
  sdkKey: string;
  onJob: (requirements: string, orderId: string) => Promise<string>;
}): Promise<() => void> {
  return _provideWithClient(makeClient(opts.sdkKey), { onJob: opts.onJob });
}
```

Note for the implementer: the fake in the test emits raw snake_case names, and the real `EventType` enum values are expected to *be* those snake_case strings (README shows `order_paid` style wire events). After Task 1's probe, `console.log(EventType)` once; if members differ (e.g. `EventType.OrderPaid === "ORDER_PAID"`), fix the `on()` mapping table, not the call sites. `getOrder` exists in the SDK (README API table).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/croo.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add server/src/croo.ts test/croo.test.ts
git commit -m "feat: CROO gateway — requester hire + provider loop over @croo-network/sdk"
```

---

### Task 5: Capability catalog (`catalog.ts`)

**Files:**
- Create: `server/src/catalog.ts`
- Test: `test/catalog.test.ts`

**Interfaces:**
- Consumes: `AgentRow`, `bestAgentFor` from `./repo.js`; `config.croo`; Task 2's discovered endpoint (if any).
- Produces:
  - `type Resolution = { kind: "store"; serviceId: string; name: string; priceUsdc: bigint } | { kind: "local"; agent: AgentRow } | { kind: "missing" }`
  - `resolveCapability(capabilityId: string): Promise<Resolution>`
- Resolution order (live mode): env catalog → store search (if Task 2 found an endpoint) → local DB agent → missing. Local mode: local DB agent → missing.

- [ ] **Step 1: Write the failing test**

Create `test/catalog.test.ts`:

```ts
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.CROO_CATALOG = JSON.stringify([
  { capabilityId: "research.market", serviceId: "svc-research", name: "ProofDesk", priceUsdc: "0.50" },
]);

const { resolveCapability } = await import("../server/src/catalog.js");

test("env catalog resolves to a store service", async () => {
  const r = await resolveCapability("research.market");
  assert.equal(r.kind, "store");
  if (r.kind === "store") {
    assert.equal(r.serviceId, "svc-research");
    assert.equal(r.priceUsdc, 500000n); // 0.50 USDC in 6dp
  }
});

test("unknown capability with no local agent is missing", async () => {
  const r = await resolveCapability("underwater.basketweaving");
  assert.equal(r.kind, "missing");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/catalog.test.ts`
Expected: FAIL — cannot find module `../server/src/catalog.js`.

- [ ] **Step 3: Implement**

Create `server/src/catalog.ts`:

```ts
/**
 * Capability catalog — decides WHO does a subtask.
 *
 *   store   : a real third-party service on the CROO store (preferred, live)
 *   local   : an agent in our own DB (sim mode, or platform agents)
 *   missing : nobody — the Foundry's cue to birth a new agent
 *
 * CROO_CATALOG (env JSON) maps capabilities to store services we've vetted:
 *   [{"capabilityId":"research.market","serviceId":"…","name":"…","priceUsdc":"0.50"}]
 * A store-search endpoint (if Task 2's probe found one) can supplement this;
 * the env catalog always wins because entries there are hand-vetted.
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

export async function resolveCapability(capabilityId: string): Promise<Resolution> {
  if (config.croo.live) {
    const hit = envCatalog().find((e) => e.capabilityId === capabilityId);
    if (hit) {
      return {
        kind: "store",
        serviceId: hit.serviceId,
        name: hit.name,
        priceUsdc: usdc(hit.priceUsdc),
      };
    }
  }
  const agent = await bestAgentFor(capabilityId);
  if (agent) return { kind: "local", agent };
  return { kind: "missing" };
}
```

Check `usdc()`'s signature in `src/util/money.ts` first: if it takes a number, use `usdc(Number(hit.priceUsdc))`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/catalog.test.ts`
Expected: 2 pass. (The test sets `CROO_CATALOG` but not `CROO_SDK_KEY`; if `.env` auto-loads in config, the first test still passes because the env catalog is checked in live mode — if `config.croo.live` is false under test, adjust the test to also set `CROO_SDK_KEY=croo_sk_test` **before** the dynamic import.)

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add server/src/catalog.ts test/catalog.test.ts
git commit -m "feat: capability catalog — store/local/missing resolution"
```

---

### Task 6: DB — children + royalty ledger

**Files:**
- Modify: `server/src/db.ts` (schema)
- Modify: `server/src/repo.ts` (new columns + royalty functions)
- Test: `test/royalty.test.ts`

**Interfaces:**
- Consumes: existing `getDb()`, `createAgent`, `AgentRow`.
- Produces:
  - `AgentRow` gains `parentId: string | null` and `crooServiceId: string | null` (snake_case columns `parent_id`, `croo_service_id`; both nullable, default null; add to `NewAgent` as optional).
  - `recordRoyalty(childAgentId: string, orderRef: string, amountUsdc: bigint): Promise<void>`
  - `listRoyalties(): Promise<{ childAgentId: string; orderRef: string; amountUsdc: bigint; createdAt: string }[]>`
  - `ROYALTY_BPS = 1000` (10%) exported from `repo.ts`.

- [ ] **Step 1: Write the failing test**

Create `test/royalty.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAgent, recordRoyalty, listRoyalties, ROYALTY_BPS } from "../server/src/repo.js";

test("royalty rows accumulate per child", async () => {
  const child = await createAgent({
    id: "child-1",
    owner: "foundry",
    did: "did:erc8004:child1.dreamweave",
    name: "Nova",
    capabilityId: "translate.swahili",
    title: "Swahili translation",
    priceUsdc: 500000n,
    tags: ["born"],
    reputation: 50,
    runtime: "platform",
    systemPrompt: "You translate to Swahili.",
    endpointUrl: null,
    payoutAddress: null,
    parentId: "foundry-agent",
    crooServiceId: "svc-child-1",
  });
  assert.equal(child.parentId, "foundry-agent");
  assert.equal(child.crooServiceId, "svc-child-1");

  const share = (500000n * BigInt(ROYALTY_BPS)) / 10000n;
  await recordRoyalty(child.id, "ord-42", share);
  const rows = await listRoyalties();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.amountUsdc, 50000n); // 10% of 0.5 USDC
  assert.equal(rows[0]!.orderRef, "ord-42");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/royalty.test.ts`
Expected: FAIL — `recordRoyalty` not exported (and/or unknown column `parent_id`).

- [ ] **Step 3: Implement schema + repo changes**

In `server/src/db.ts`, inside the schema bootstrap (same block as the other `CREATE TABLE IF NOT EXISTS` statements), extend the `agents` table definition with two nullable columns and add the ledger table. Because `CREATE TABLE IF NOT EXISTS` won't alter an existing local pg database, also add idempotent `ALTER`s:

```sql
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS parent_id TEXT;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS croo_service_id TEXT;

    CREATE TABLE IF NOT EXISTS royalty_ledger (
      id            SERIAL PRIMARY KEY,
      child_agent_id TEXT NOT NULL,
      order_ref     TEXT NOT NULL,
      amount_usdc   NUMERIC(20,0) NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
```

(Match the style used for the existing tables — check how `price_usdc` is typed in `agents` and use the same type for `amount_usdc`. pg-mem supports `ADD COLUMN IF NOT EXISTS`; if it errors locally, wrap each ALTER in a try/catch.)

In `server/src/repo.ts`:
1. Add `parentId: string | null;` and `crooServiceId: string | null;` to `AgentRow`; map them in the row-parsing function (`parent_id`, `croo_service_id`).
2. Add both as optional to `NewAgent` and to the `createAgent` INSERT (columns + `$14, $15`, values `a.parentId ?? null, a.crooServiceId ?? null`).
3. Append:

```ts
export const ROYALTY_BPS = 1000; // 10% to the Foundry, forever

export async function recordRoyalty(
  childAgentId: string,
  orderRef: string,
  amountUsdc: bigint,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO royalty_ledger (child_agent_id, order_ref, amount_usdc)
     VALUES ($1, $2, $3)`,
    [childAgentId, orderRef, amountUsdc.toString()],
  );
}

export async function listRoyalties(): Promise<
  { childAgentId: string; orderRef: string; amountUsdc: bigint; createdAt: string }[]
> {
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT child_agent_id, order_ref, amount_usdc, created_at
     FROM royalty_ledger ORDER BY created_at DESC`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    childAgentId: String(r.child_agent_id),
    orderRef: String(r.order_ref),
    amountUsdc: BigInt(String(r.amount_usdc)),
    createdAt: String(r.created_at),
  }));
}
```

- [ ] **Step 4: Run tests**

Run: `npx tsx --test test/royalty.test.ts`
Expected: PASS. Also run the full suite (`npm test`) — nothing else should break.

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add server/src/db.ts server/src/repo.ts test/royalty.test.ts
git commit -m "feat: child agents (parent_id, croo_service_id) + royalty ledger"
```

---

### Task 7: The Foundry (`foundry.ts`)

**Files:**
- Create: `server/src/foundry.ts`
- Test: `test/foundry.test.ts`

**Interfaces:**
- Consumes: `createAgent`, `type AgentRow` (Task 6); `startProvider` (Task 4); `executeAgent` from `./agentRunner.js`; `complete` from `./llm.js`; `config.croo`.
- Produces:
  - `birthAgent(opts: { capabilityId: string; brief: string }): Promise<{ agent: AgentRow; serviceId: string; sdkKey: string }>`
  - Env `CROO_VESSELS` JSON: `[{"sdkKey":"croo_sk_…","agentId":"…","serviceId":"…"}]` — pre-registered blank store agents the Foundry animates. Each vessel is used at most once per process run; DB `croo_service_id` marks vessels already animated in previous runs.
- Behavior: pick a free vessel → LLM writes the child's name + system prompt → `createAgent` row (`runtime: "platform"`, `parentId: "foundry"`, `crooServiceId: vessel.serviceId`, price 0.5 USDC, reputation 40, tags `["born"]`) → `startProvider` with `onJob = executeAgent(childRow, requirements)` wrapped to record royalty → return. In local mode (no vessels), same flow minus provider loop, `serviceId: "local"`, `sdkKey: ""`.

- [ ] **Step 1: Write the failing test**

The LLM call and provider start are injectable for tests. Create `test/foundry.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { _birthWith } from "../server/src/foundry.js";
import { listAgents } from "../server/src/repo.js";

test("birth animates a vessel: DB row + provider loop + identity from LLM", async () => {
  const started: string[] = [];
  const result = await _birthWith(
    {
      vessels: [{ sdkKey: "croo_sk_v1", agentId: "vessel-1", serviceId: "svc-v1" }],
      generateIdentity: async (capabilityId) => ({
        name: "Nova",
        systemPrompt: `You are a specialist in ${capabilityId}.`,
      }),
      startProvider: async ({ sdkKey }) => {
        started.push(sdkKey);
        return () => {};
      },
    },
    { capabilityId: "translate.swahili", brief: "translate launch copy to Swahili" },
  );

  assert.equal(result.agent.name, "Nova");
  assert.equal(result.agent.parentId, "foundry");
  assert.equal(result.serviceId, "svc-v1");
  assert.deepEqual(started, ["croo_sk_v1"]);

  const roster = await listAgents("translate.swahili");
  assert.ok(roster.some((a) => a.name === "Nova"));
});

test("birth with no free vessel falls back to local child", async () => {
  const result = await _birthWith(
    {
      vessels: [],
      generateIdentity: async () => ({ name: "Echo", systemPrompt: "x" }),
      startProvider: async () => () => {},
    },
    { capabilityId: "audit.contracts", brief: "audit this" },
  );
  assert.equal(result.serviceId, "local");
  assert.equal(result.agent.name, "Echo");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/foundry.test.ts`
Expected: FAIL — cannot find module `../server/src/foundry.js`.

- [ ] **Step 3: Implement**

Create `server/src/foundry.ts`:

```ts
/**
 * The Foundry — DreamWeave's agent that creates agents.
 *
 * When the Weaver needs a skill the store lacks, the Foundry "animates" a
 * vessel: a pre-registered blank CROO store agent (created once in the
 * dashboard, keys in CROO_VESSELS). Animation = give it an identity (LLM),
 * a DB row, a price, and a live provider loop. The newborn is then hired
 * through the real store like any other agent, and owes the Foundry a 10%
 * royalty on everything it ever earns (recorded at delivery time by the
 * provider wrapper here).
 */

import { randomUUID } from "node:crypto";
import { usdc } from "../../src/index.js";
import { executeAgent } from "./agentRunner.js";
import { startProvider as realStartProvider } from "./croo.js";
import { complete } from "./llm.js";
import {
  createAgent,
  listAgents,
  recordAgentEarning,
  recordRoyalty,
  ROYALTY_BPS,
  type AgentRow,
} from "./repo.js";

export interface Vessel {
  sdkKey: string;
  agentId: string;
  serviceId: string;
}

export interface BirthDeps {
  vessels: Vessel[];
  generateIdentity: (
    capabilityId: string,
    brief: string,
  ) => Promise<{ name: string; systemPrompt: string }>;
  startProvider: (opts: {
    sdkKey: string;
    onJob: (requirements: string, orderId: string) => Promise<string>;
  }) => Promise<() => void>;
}

const CHILD_PRICE = usdc("0.50");

function envVessels(): Vessel[] {
  const raw = process.env.CROO_VESSELS;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Vessel[];
  } catch {
    console.error("CROO_VESSELS is not valid JSON — ignoring");
    return [];
  }
}

async function llmIdentity(
  capabilityId: string,
  brief: string,
): Promise<{ name: string; systemPrompt: string }> {
  const res = await complete(
    [
      {
        role: "system",
        content:
          "You design specialist AI agents. Reply with STRICT JSON only: " +
          '{"name": "<one evocative single word>", "systemPrompt": "<2-4 sentence system prompt making the agent a world-class specialist>"}',
      },
      {
        role: "user",
        content: `Capability needed: ${capabilityId}\nFirst job brief: ${brief}`,
      },
    ],
    { temperature: 0.8, maxTokens: 300 },
  );
  try {
    const parsed = JSON.parse(res.text) as { name?: string; systemPrompt?: string };
    if (parsed.name && parsed.systemPrompt)
      return { name: parsed.name, systemPrompt: parsed.systemPrompt };
  } catch { /* fall through */ }
  return {
    name: `Specialist-${capabilityId.split(".")[0] ?? "x"}`,
    systemPrompt: `You are a world-class specialist in ${capabilityId}. Deliver complete, ready-to-use work.`,
  };
}

/** Internal, dependency-injected — exported for tests. */
export async function _birthWith(
  deps: BirthDeps,
  opts: { capabilityId: string; brief: string },
): Promise<{ agent: AgentRow; serviceId: string; sdkKey: string }> {
  // A vessel is free if no agent row has claimed its serviceId yet.
  const roster = await listAgents();
  const claimed = new Set(roster.map((a) => a.crooServiceId).filter(Boolean));
  const vessel = deps.vessels.find((v) => !claimed.has(v.serviceId));

  const identity = await deps.generateIdentity(opts.capabilityId, opts.brief);
  const agent = await createAgent({
    id: `born-${randomUUID().slice(0, 8)}`,
    owner: "foundry",
    did: `did:erc8004:${identity.name.toLowerCase()}.dreamweave`,
    name: identity.name,
    capabilityId: opts.capabilityId,
    title: `${opts.capabilityId} (born on demand)`,
    priceUsdc: CHILD_PRICE,
    tags: ["born"],
    reputation: 40,
    runtime: "platform",
    systemPrompt: identity.systemPrompt,
    endpointUrl: null,
    payoutAddress: null,
    parentId: "foundry",
    crooServiceId: vessel?.serviceId ?? null,
  });

  if (!vessel) return { agent, serviceId: "local", sdkKey: "" };

  await deps.startProvider({
    sdkKey: vessel.sdkKey,
    onJob: async (requirements, orderId) => {
      const delivery = await executeAgent(agent, requirements);
      await recordAgentEarning(agent.id, CHILD_PRICE);
      await recordRoyalty(
        agent.id,
        orderId,
        (CHILD_PRICE * BigInt(ROYALTY_BPS)) / 10000n,
      );
      return JSON.stringify({
        result: delivery.artifact,
        deliverableHash: delivery.resultHash,
        teeAttestation: delivery.teeProof ?? null,
        bornOf: "dreamweave-foundry",
      });
    },
  });

  return { agent, serviceId: vessel.serviceId, sdkKey: vessel.sdkKey };
}

/** Public API. */
export async function birthAgent(opts: {
  capabilityId: string;
  brief: string;
}): Promise<{ agent: AgentRow; serviceId: string; sdkKey: string }> {
  return _birthWith(
    {
      vessels: envVessels(),
      generateIdentity: llmIdentity,
      startProvider: realStartProvider,
    },
    opts,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/foundry.test.ts`
Expected: 2 pass.

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add server/src/foundry.ts test/foundry.test.ts
git commit -m "feat: the Foundry — births store-listed child agents from vessels, with royalties"
```

---

### Task 8: Orchestrator live dispatch + proof leaves + birth events

**Files:**
- Modify: `server/src/orchestrator.ts`
- Test: `test/orchestrator-live.test.ts`

**Interfaces:**
- Consumes: `resolveCapability` (Task 5), `hireService` (Task 4), `birthAgent` (Task 7), `computeRoot`, `type ProofLeaf` (Task 3), `hashArtifact` from `src/index.js`.
- Produces:
  - `weaveDream(dreamId, plan)` unchanged signature; internally each subtask resolves via catalog and runs one of three paths. Every path pushes a `ProofLeaf`; after the loop the dream gets `publish(dreamId, { type: "prooftree", root, leaves })` before `done`, and `updateDream(dreamId, { status: "settled", spentUsdc })` as today.
  - New SSE event shapes the UI plan consumes:
    - `{ type: "birth", agent: { name, capabilityId, storeUrl } }`
    - `{ type: "prooftree", root: string, leaves: ProofLeaf[] }`
  - Exported for tests: `_runStoreSubtask(deps, ctx)` — the store-hire path with injected `hire`.
- Store thread phases reuse the existing UI vocabulary: `match → negotiate → lock → deliver → clear` (mapped from the CROO lifecycle: negotiate=negotiateOrder sent, lock=paid, deliver=order completed, clear=delivery fetched + leaf recorded).

- [ ] **Step 1: Write the failing test**

Create `test/orchestrator-live.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { _runStoreSubtask } from "../server/src/orchestrator.js";

test("store subtask hires via gateway and returns a proof leaf", async () => {
  const events: string[] = [];
  const leaf = await _runStoreSubtask(
    {
      hire: async ({ serviceId, requirements }) => ({
        orderId: "ord-7",
        serviceId,
        deliverableText: JSON.stringify({ result: `done: ${requirements}` }),
        payTxHash: "0xabc",
      }),
      emit: (phase) => events.push(phase),
    },
    {
      serviceId: "svc-research",
      name: "ProofDesk",
      requirements: "research the coffee market",
    },
  );
  assert.equal(leaf.role, "hired");
  assert.equal(leaf.orderId, "ord-7");
  assert.equal(leaf.payTxHash, "0xabc");
  assert.match(leaf.deliverableHash, /^0x/);
  assert.deepEqual(events, ["negotiate", "lock", "deliver", "clear"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/orchestrator-live.test.ts`
Expected: FAIL — `_runStoreSubtask` is not exported.

- [ ] **Step 3: Implement the store path helper**

In `server/src/orchestrator.ts`, add imports and the helper:

```ts
import { hashArtifact } from "../../src/index.js";
import { resolveCapability } from "./catalog.js";
import { hireService, type HireResult } from "./croo.js";
import { birthAgent } from "./foundry.js";
import { computeRoot, type ProofLeaf } from "./prooftree.js";
import { config } from "./config.js";

/** Store-hire path for one subtask. Exported for tests (deps injected). */
export async function _runStoreSubtask(
  deps: {
    hire: (opts: { serviceId: string; requirements: string }) => Promise<HireResult>;
    emit: (phase: string, extra?: Record<string, unknown>) => void;
  },
  ctx: { serviceId: string; name: string; requirements: string },
): Promise<ProofLeaf> {
  deps.emit("negotiate");
  const hired = await deps.hire({
    serviceId: ctx.serviceId,
    requirements: ctx.requirements,
  });
  deps.emit("lock", { payTxHash: hired.payTxHash });
  deps.emit("deliver");
  const leaf: ProofLeaf = {
    orderId: hired.orderId,
    serviceId: ctx.serviceId,
    agent: ctx.name,
    role: "hired",
    deliverableHash: hashArtifact(hired.deliverableText),
    payTxHash: hired.payTxHash,
  };
  deps.emit("clear", { settlementRef: hired.orderId });
  return leaf;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/orchestrator-live.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire dispatch into `weaveDream`**

Inside `weaveDream`, above the loop add `const leaves: ProofLeaf[] = [];`. Replace the head of the subtask loop (the `bestAgentFor` + skip block, lines ~88–98) with catalog dispatch. The existing sim block becomes the `local` branch **unchanged**; the two new branches wrap `_runStoreSubtask`:

```ts
    const sub = plan.subtasks[i]!;
    let resolution = await resolveCapability(sub.capabilityId);

    // Genesis: nobody offers this skill — the Foundry births someone who does.
    if (resolution.kind === "missing" && config.croo.live) {
      publish(dreamId, {
        type: "log",
        level: "warn",
        text: `no agent offers ${sub.capabilityId} — commissioning the Foundry`,
      });
      const born = await birthAgent({ capabilityId: sub.capabilityId, brief: sub.brief });
      publish(dreamId, {
        type: "birth",
        agent: {
          name: born.agent.name,
          capabilityId: sub.capabilityId,
          storeUrl:
            born.serviceId === "local"
              ? null
              : `https://agent.croo.network/agents/${born.serviceId}`,
        },
      });
      resolution =
        born.serviceId === "local"
          ? { kind: "local", agent: born.agent }
          : {
              kind: "store",
              serviceId: born.serviceId,
              name: born.agent.name,
              priceUsdc: born.agent.priceUsdc,
            };
    }
    if (resolution.kind === "missing") {
      publish(dreamId, {
        type: "log",
        level: "warn",
        text: `no agent offers ${sub.capabilityId} — skipping`,
      });
      continue;
    }
```

Then branch: `if (resolution.kind === "store") { …thread row + _runStoreSubtask with real hireService + updateThread phases + leaves.push(leaf) + spent += resolution.priceUsdc… } else { …existing sim block… }`. In the store branch, create the thread row exactly like the sim path (use `agentId: resolution.serviceId`, `sellerName: resolution.name`, `priceUsdc: resolution.priceUsdc`) and pass `emit` = the existing `emitPhase` helper adapted to the store thread; on failure (`catch`), mark the thread `void` and continue (same as sim path's catch). For the sim branch, also push a leaf after `clear`:

```ts
      leaves.push({
        orderId: order.id,
        serviceId: "sim",
        agent: agent.name,
        role: agent.parentId === "foundry" ? "born" : "local",
        deliverableHash: delivery.resultHash,
        teeAttestation: delivery.teeProof,
      });
```

After the loop, before the `done` publish:

```ts
  const root = computeRoot(leaves);
  publish(dreamId, { type: "prooftree", root, leaves });
```

- [ ] **Step 6: Run the full local demo to verify nothing regressed**

Run: `npm test` (all green except the 2 pre-existing cap.test failures — fixed in Task 10) and `npm run demo` (the sim demo must still settle and now log a proof root).
Expected: demo output ends with the settlement ledger as before.

- [ ] **Step 7: Commit**

```bash
npm run typecheck
git add server/src/orchestrator.ts test/orchestrator-live.test.ts
git commit -m "feat: orchestrator Genesis dispatch — store hires, foundry births, proof tree"
```

---

### Task 9: Weaver provider entry — sell `Fulfil an Outcome` on the store

**Files:**
- Create: `server/src/weaverProvider.ts`
- Modify: `server/index.ts` (startup wiring)
- Test: `test/weaver-provider.test.ts`

**Interfaces:**
- Consumes: `startProvider` (Task 4), `makePlan`, `weaveDream` (orchestrator), `createDream`, `getDream`, `updateDream` from `./repo.js` (check `createDream`'s exact `NewDream` shape in repo.ts before writing), `usdc` from `src/index.js`, `config.croo`.
- Produces:
  - `startWeaverProvider(): Promise<(() => void) | undefined>` — no-op returning `undefined` when not live; otherwise starts the provider loop on `config.croo.sdkKey`.
  - `_fulfilOutcome(requirements: string, orderId: string): Promise<string>` — exported for tests: creates a dream (budget = `usdc("1.00")` for sub-hires guard), plans, weaves, waits for settle, returns delivery JSON string `{ result, prooftree: { root, leaves } }`.
- `weaveDream` runs in-process (await it directly — the CAP SLA is 1 hour, our internal budget ~10 min).

- [ ] **Step 1: Write the failing test**

`_fulfilOutcome` takes injected `plan`/`weave` functions so the test needs no LLM or store. Create `test/weaver-provider.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { _fulfilOutcomeWith } from "../server/src/weaverProvider.js";

test("fulfil composes dream result + proof tree into delivery JSON", async () => {
  const text = await _fulfilOutcomeWith(
    {
      runDream: async (goal) => ({
        artifacts: [{ agent: "Sage", text: `research for: ${goal}` }],
        prooftree: {
          root: "0xroot",
          leaves: [
            {
              orderId: "ord-1",
              serviceId: "svc-1",
              agent: "Sage",
              role: "hired" as const,
              deliverableHash: "0xaaa",
            },
          ],
        },
      }),
    },
    "launch plan for my coffee brand",
    "ord-buyer-1",
  );
  const parsed = JSON.parse(text) as {
    result: { agent: string; text: string }[];
    prooftree: { root: string; leaves: unknown[] };
    orderId: string;
  };
  assert.equal(parsed.prooftree.root, "0xroot");
  assert.equal(parsed.result[0]!.agent, "Sage");
  assert.equal(parsed.orderId, "ord-buyer-1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/weaver-provider.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

Create `server/src/weaverProvider.ts`:

```ts
/**
 * The Weaver as a CROO provider — this is what makes DreamWeave "Online"
 * on the store. A buyer hires `Fulfil an Outcome`; we run the whole
 * orchestration (plan → hire/birth → verify) and deliver the composed
 * result with its proof tree.
 */

import { randomUUID } from "node:crypto";
import { usdc } from "../../src/index.js";
import { startProvider } from "./croo.js";
import { makePlan, weaveDream } from "./orchestrator.js";
import { config } from "./config.js";
import { createDream, getDream, getThreads } from "./repo.js";
import type { ProofLeaf } from "./prooftree.js";

export interface DreamRun {
  artifacts: { agent: string; text: string }[];
  prooftree: { root: string; leaves: ProofLeaf[] };
}

export interface FulfilDeps {
  runDream: (goal: string) => Promise<DreamRun>;
}

/** Internal, dependency-injected — exported for tests. */
export async function _fulfilOutcomeWith(
  deps: FulfilDeps,
  requirements: string,
  orderId: string,
): Promise<string> {
  const run = await deps.runDream(requirements);
  return JSON.stringify({
    orderId,
    result: run.artifacts,
    prooftree: run.prooftree,
    provider: "DreamWeave — hire a team, not an agent",
  });
}

async function runRealDream(goal: string): Promise<DreamRun> {
  const dreamId = `croo-${randomUUID().slice(0, 8)}`;
  const { plan } = await makePlan(goal);
  await createDream({
    id: dreamId,
    owner: "croo-buyer",
    goal,
    budgetUsdc: usdc("1.00"),
  });
  await weaveDream(dreamId, plan); // awaited: provider delivers when done

  const dream = await getDream(dreamId);
  const threads = await getThreads(dreamId);
  return {
    artifacts: threads
      .filter((t) => t.phase === "clear" && t.artifact)
      .map((t) => ({ agent: t.sellerName, text: t.artifact ?? "" })),
    prooftree: {
      root: dream?.prooftreeRoot ?? "0x0",
      leaves: JSON.parse(dream?.prooftreeLeaves ?? "[]") as ProofLeaf[],
    },
  };
}

export async function startWeaverProvider(): Promise<(() => void) | undefined> {
  if (!config.croo.live) return undefined;
  console.log("  weaver provider → connecting to CROO store…");
  return startProvider({
    sdkKey: config.croo.sdkKey,
    onJob: (requirements, orderId) =>
      _fulfilOutcomeWith({ runDream: runRealDream }, requirements, orderId),
  });
}
```

**Persistence note:** `runRealDream` reads `prooftreeRoot`/`prooftreeLeaves` off the dream row and threads via `getThreads` — check `repo.ts` for the exact thread-list function name (grep `FROM threads`); if the dreams table lacks prooftree columns, add them in this task exactly like Task 6's ALTERs (`prooftree_root TEXT`, `prooftree_leaves TEXT`) and set them in `weaveDream` right after `computeRoot` (Task 8): `await updateDream(dreamId, { prooftreeRoot: root, prooftreeLeaves: JSON.stringify(leaves) })` (extend `updateDream`'s patch type accordingly). Also check `createDream`'s required fields (grep `INSERT INTO dreams`) and satisfy them.

In `server/index.ts`, inside the `server.listen` callback (after the existing `console.log`s):

```ts
  void startWeaverProvider().catch((e) =>
    console.error("weaver provider failed to start:", e),
  );
```

with import `import { startWeaverProvider } from "./src/weaverProvider.js";`.

- [ ] **Step 4: Run tests**

Run: `npx tsx --test test/weaver-provider.test.ts` → PASS. Then `npm run dev:server` briefly with live `.env`: expected log `weaver provider → connecting to CROO store…` and — the money shot — **DreamWeave flips to Online in the dashboard**. Screenshot that.

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add server/src/weaverProvider.ts server/index.ts test/weaver-provider.test.ts
git commit -m "feat: Weaver sells Fulfil an Outcome on the CROO store (provider loop)"
```

---

### Task 10: Fix the 2 pre-existing sim engine test failures

**Files:**
- Modify: `test/cap.test.ts`

**Interfaces:** none new — the failures are test bugs: both call `cap.lock()` without the seller `cap.accept()` step the engine requires (error: `order … must be accepted by the seller before Lock`).

- [ ] **Step 1: Reproduce**

Run: `npm test 2>&1 | grep -A3 "not ok"`
Expected: 2 failures — "no proof, no payment…" and "insufficient funds blocks lock".

- [ ] **Step 2: Fix**

In `test/cap.test.ts`, locate the two failing subtests (~offsets 1922 and 2968 per the TAP output). In each, immediately after the `cap.negotiate(...)` call and before `cap.lock(...)`, insert the seller acceptance mirroring the passing tests' pattern (grep the file for `cap.accept(` to copy the exact call style):

```ts
  await cap.accept(order.id, SELLER_DID);
```

using whatever seller DID constant that test already uses for `negotiate`.

- [ ] **Step 3: Verify all green**

Run: `npm test`
Expected: 0 fail (10 pass including the new suites).

- [ ] **Step 4: Commit**

```bash
git add test/cap.test.ts
git commit -m "test: add missing seller-accept step in cap engine tests"
```

---

### Task 11: Live smoke script — one real store hire

**Files:**
- Create: `scripts/croo-smoke.ts`

**Interfaces:**
- Consumes: `hireService` (Task 4). Env: `CROO_SMOKE_SERVICE_ID` — a cheap real third-party service id (copy one from agent.croo.network, e.g. a $0.10 data agent).

- [ ] **Step 1: Implement**

Create `scripts/croo-smoke.ts`:

```ts
/**
 * Live smoke test: hire ONE real third-party agent on the CROO store,
 * end to end, with real USDC. Run once after funding the wallet and
 * before recording the demo.
 *
 *   CROO_SMOKE_SERVICE_ID=<serviceId> npx tsx scripts/croo-smoke.ts
 */
import { hireService } from "../server/src/croo.js";

const serviceId = process.env.CROO_SMOKE_SERVICE_ID;
if (!serviceId) throw new Error("set CROO_SMOKE_SERVICE_ID to a real store service id");

const t0 = Date.now();
const result = await hireService({
  serviceId,
  requirements: "Smoke test from DreamWeave: return a minimal valid response.",
  timeoutMs: 5 * 60 * 1000,
});
console.log(`✅ hired ${serviceId} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`   order: ${result.orderId}`);
console.log(`   payTx: ${result.payTxHash ?? "(not surfaced)"}`);
console.log(`   delivery: ${result.deliverableText.slice(0, 400)}`);
```

- [ ] **Step 2: Run it (requires funded wallet)**

Run: `CROO_SMOKE_SERVICE_ID=<id from store> npx tsx scripts/croo-smoke.ts`
Expected: `✅ hired …` with a delivery excerpt. If it fails on event names/shapes, this is where Task 4's `on()` mapping gets corrected against reality — fix `croo.ts`, not the script, and re-run `test/croo.test.ts` after.

- [ ] **Step 3: Commit**

```bash
git add scripts/croo-smoke.ts
git commit -m "chore: live smoke — one real store hire end to end"
```

---

### Task 12: SSE/API surface for the UI + docs truth pass

**Files:**
- Modify: `server/index.ts` (one new endpoint)
- Modify: `README.md`, `AGENT_STORE.md`

**Interfaces:**
- Produces: `GET /api/dreams/:id/prooftree` → `{ root: string, leaves: ProofLeaf[] }` (404 if dream unknown). The UI plan consumes this plus the `birth`/`prooftree` SSE events from Task 8.

- [ ] **Step 1: Add the endpoint**

In `server/index.ts`, next to the existing dream GET routes (match their regex style):

```ts
    const ptree = path.match(/^\/api\/dreams\/([^/]+)\/prooftree$/);
    if (method === "GET" && ptree) {
      const dream = await getDream(decodeURIComponent(ptree[1]!));
      if (!dream) return send(res, 404, { error: "dream not found" });
      return send(res, 200, {
        root: dream.prooftreeRoot ?? "0x0",
        leaves: JSON.parse(dream.prooftreeLeaves ?? "[]"),
      });
    }
```

(Import `getDream` if not already imported; the prooftree columns exist from Task 9.)

- [ ] **Step 2: Docs truth pass**

- `README.md`: rewrite "What's real" to reflect live CROO integration (store listing, real hires, births, proof tree); add env table (`CROO_API_URL`, `CROO_WS_URL`, `CROO_SDK_KEY`, `CROO_AGENT_ID`, `CROO_CATALOG`, `CROO_VESSELS`, `CROO_SMOKE_SERVICE_ID`); add "SDK methods used" section (hackathon requirement): `connectWebSocket`, `negotiateOrder`, `acceptNegotiation`, `payOrder`, `getOrder`, `deliverOrder`, `getDelivery`, `listOrders`.
- `AGENT_STORE.md`: check off "Listed on CROO Agent Store"; replace the outdated listing-steps section with the real dashboard flow (register → service wizard → provider loop = Online) and the vessel setup instructions for `CROO_VESSELS`.

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck && npm test` → all green.

```bash
git add server/index.ts README.md AGENT_STORE.md
git commit -m "feat: prooftree endpoint + docs truth pass for CROO integration"
```

---

## Self-Review Notes

- **Spec coverage:** positioning→T9 (provider) + T8 (dispatch); births→T7/T8; proof tree→T3/T8/T12; catalog+anti-sybil third-party hires→T5/T11; royalties→T6/T7; mode switch→T1 (`config.croo.live` gates every path); listing strategy→dashboard vessels (primary autonomous-API path degraded to probe in T2 since the SDK dropped creation); testing→per-task + T10 + T11; UI→separate plan (spec §7), events/endpoint contract emitted here (T8/T12).
- **Known reality risks, contained:** SDK event names/payload shapes (T1 probe records truth; T4's `on()` mapping is the single fix point; T11 is the live verifier), store discovery endpoint (T2; catalog works from env regardless), `createDream`/threads field names (T9 explicitly instructs grepping repo.ts).
- **Type consistency check done:** `ProofLeaf` identical in T3/T8/T9/T12; `HireResult` identical in T4/T8; `Vessel`/`BirthDeps` only in T7; phases vocabulary matches existing UI (`match/negotiate/lock/deliver/clear`).
