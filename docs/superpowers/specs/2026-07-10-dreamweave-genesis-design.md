# DreamWeave Genesis — design

**Date:** 2026-07-10
**Target:** CROO Agent Hackathon (DoraHacks), deadline 2026-07-12 09:00
**One-liner:** *Others sell agents. Others verify agents. DreamWeave hires them — and when the right one doesn't exist, it gives birth to it.*

## 1. Positioning

DreamWeave ships as **agents on the real CROO Agent Store**, not a parallel
platform:

- **Weaver** — a listed provider agent with one service, `fulfil_outcome`.
  A buyer (human or agent) hires it via real CAP and pays USDC on Base.
  Internally it plans a crew and hires subcontractors **from the real store**
  as a requester (`negotiateOrder → payOrder → getDelivery` per hire).
- **Foundry** — a listed provider agent that *creates new agents*. When the
  Weaver's plan needs a skill the store lacks, the Foundry births a
  prompt-defined child agent (runs on 0G), lists it on the store, and the
  Weaver hires it as its first customer. Children keep earning after the
  demo and owe the Foundry a **10% royalty** on future earnings.
- **Prooftree** — every delivery (hired or born) carries a 0G TEE
  attestation; all sub-proofs compose into one Merkle-style tree whose root
  hash ships inside the Weaver's final CAP delivery.

This satisfies all five hackathon requirements (store listing, real CAP
integration, MIT open source, demo video + README, DoraHacks BUIDL). For
the anti-sybil rules, **real third-party hires carry the load** — the
Weaver must hire ≥3 agents from other teams so counterparties are genuinely
unique; births and child hires add volume and story but count as our own
wallet cluster, so they are never the only order flow.

## 2. Architecture

```
frontend/  Vite + React + framer-motion — landing + dashboard        → Vercel
server/    Node/tsx — one process on Railway hosting all our agents
  src/
    croo.ts         NEW  @croo-network/sdk wrapper: provider + requester roles
    foundry.ts      NEW  child agent minting: prompt, price, wallet, listing
    prooftree.ts    NEW  proof-leaf collection + root hash computation
    catalog.ts      NEW  store catalog: capability → serviceId resolution
    orchestrator.ts MOD  hires via croo.ts when live, sim engine locally
    planner.ts      KEEP LLM goal→crew decomposition (0G GLM)
    agentRunner.ts  KEEP 0G execution with TEE proof capture
    llm.ts / db.ts / repo.ts / events.ts / auth.ts / usdc.ts  KEEP
src/       KEEP in-process CAP sim — local mirror for dev + unit tests
```

One Railway process hosts Weaver, Foundry, and all children (one
`AgentClient` WebSocket connection per listed agent, keyed by its SDK key).

### Mode switch

`CROO_SDK_KEY` present → live mode (real store, real USDC).
Absent → local mode (sim engine, seeded roster) — the demo UI works
identically in both, so development never blocks on credentials.

## 3. The Genesis flow

1. Buyer hires Weaver's `fulfil_outcome` on the store; CROO escrow locks
   payment; Weaver's provider loop receives `OrderPaid`.
2. Planner (0G LLM) decomposes the goal into tasks with required
   capabilities and a budget per task.
3. `catalog.ts` searches the store for each capability. Found → Weaver
   hires that third-party agent via real CAP order.
4. Not found → Weaver places a CAP order with the **Foundry**
   (`commission_agent`). The Foundry mints the child: writes its system
   prompt, sets price, provisions its listing (§5), starts its provider
   loop in-process, records the 10% royalty obligation.
5. Weaver hires the newborn child through the store like any other agent.
6. Every delivery is executed on 0G (TEE attestation captured) or received
   from a third party (delivery hash + payment tx recorded). Each becomes a
   proof leaf.
7. Weaver composes results, builds the proof tree, and calls
   `deliverOrder` with the final artifact + root hash + leaf manifest.
8. Frontend streams every step live via the existing SSE hub, including a
   `birth` event linking to the child's real store page.

## 4. Proof tree

Leaf (JSON, hashed with the existing `hashArtifact` SHA-256 helper):
`{ orderId, serviceId, agent, role: hired|born, deliverableHash,
payTxHash?, teeAttestation? }`. Root = hash of sorted leaf hashes.
Delivery text includes `{ result, prooftree: { root, leaves } }` so any
buyer can re-derive the root offline. No new contract — CROO's own on-chain
orders anchor each leaf's payment.

## 5. Store listing strategy (the one open risk)

SDK 0.2.1 moved agent/service creation to the Dashboard, but 0.1.0 exposed
`createAgent` / `createService` (`POST /agents`, `/services`).

- **Primary:** call those endpoints against `api.croo.network` with our SDK
  key. Verify with a probe script the moment credentials exist.
- **Fallback (guaranteed):** pre-create 3–5 blank "vessel" agents in the
  Dashboard ahead of time (SDK keys stored as env vars). The Foundry
  "animates" a vessel at birth: assigns identity, prompt, and price at
  runtime. The store listing is real either way; only the creation step
  differs. The demo narrative is identical.

## 6. Royalty ledger

v1 is in-logic: `repo.ts` gains a `royalties` table; every child `clear`
records 10% owed to the Foundry, shown in the UI as an animated flow.
Actual on-chain royalty transfer from the child's AA wallet is a stretch
goal, not required for the demo. (Stated honestly in README.)

## 7. Killer UI

Ambition: the most memorable demo video in the field. Direction (final
craft decisions during implementation via the frontend-design skill):

- **Design language:** "night loom" — deep-dark canvas, luminous thread
  gradients, weaving metaphor everywhere. Custom, not template-looking.
- **Landing page:** animated hero where loose threads weave themselves into
  a tapestry; scroll-driven retelling of the Genesis flow; live store stats.
- **The Loom (run view):** the centerpiece. Each hired agent is a glowing
  thread spooling across the screen through the CAP phases; TEE seals snap
  on at delivery; settlements pulse USDC along the thread. When the Foundry
  births an agent, the loom forges a new spool in a light burst with a
  badge linking to its live store page.
- **Prooftree viewer:** expandable tree of leaves with hashes, copy
  buttons, and links to the store order + Base tx.
- **Roster:** agent cards with earnings; children show royalty streams
  animating back to the Foundry.
- **Motion system:** framer-motion (already installed), spring physics,
  60fps budget, `prefers-reduced-motion` respected.

## 8. Prerequisites (user-provided)

CROO Dashboard account; SDK key(s) `croo_sk_…`; AA wallet funded with USDC
on Base mainnet (a few dollars); existing 0G API key (already working).

## 9. Testing & verification

- Unit tests keep running against the sim engine (fix the 2 pre-existing
  sim test failures — missing seller-accept step — while touching it).
- `scripts/croo-smoke.ts`: one real store order end-to-end (hire a cheap
  third-party agent, verify `OrderCompleted` + delivery), run before demo.
- Full dress rehearsal: one dream through live mode with ≥2 third-party
  hires + 1 birth, captured for the ≤5-min video.

## 10. Out of scope

Code-generated (non-prompt) children; on-chain royalty enforcement
contract; own escrow/settlement of any kind; multi-region hosting; child
agents surviving a server restart with re-negotiated listings (they
restart with the process from DB state).
