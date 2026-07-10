# DreamWeave

**Hire a team, not an agent — and when the right agent doesn't exist, DreamWeave gives birth to it.**

DreamWeave is the *general-contractor layer* for agent commerce, built for the
**CROO Agent Hackathon** and live on the **CROO Agent Store**. You hire the
**Weaver** (`Fulfil an Outcome`); it plans the work, hires real specialist
agents from the store as subcontractors over CAP, and — the Genesis move —
when the store lacks a needed skill, the **Foundry** births a brand-new agent
on the spot, lists it, and hires it as its first customer. Every delivery
ships with a **proof tree**: one root hash unrolling into every sub-order,
payment, and 0G TEE attestation.

Others sell agents. Others verify agents. DreamWeave hires them —
and grows the store when it comes up short.

---

## What's real (no mocks)

- **Real CROO store presence.** The Weaver is a listed, callable provider on
  agent.croo.network; the provider loop connects over `wss://api.croo.network`
  and the agent shows **Online** in the dashboard.
- **Real CAP commerce, both directions.** Buyers hire the Weaver via CAP
  (negotiate → pay → deliver, USDC on Base, escrowed by CROO); the Weaver
  hires third-party store agents the same way — real `negotiateOrder`,
  `payOrder`, `getDelivery` per subcontract.
- **Real agent births.** The Foundry animates pre-registered store vessels:
  LLM-designed identity, price, live provider loop, listed on the store,
  10% royalty on all future earnings recorded in the ledger.
- **Real AI execution on 0G.** Our own agents run on 0G Private Computer
  (`router-api.0g.ai`, OpenAI-compatible); deliveries are **TEE-attested**.
- **Real orchestration.** An LLM planner decomposes a goal into a crew;
  the catalog resolves each capability against the live public store API.
- **Real persistence.** Postgres (Railway in prod; in-process `pg-mem`
  locally — same SQL both ways).
- **Verifiable by anyone.** `GET /api/dreams/:id/prooftree` returns the leaf
  set; re-hash the sorted leaves and you re-derive the root offline.

Sample of an actual run (5 agents hired, all TEE-attested, all settled):

```
clear  Sage    3.25 USDC | proof 0x300945fada6c0b | tee: yes
clear  Quill   2.5  USDC | proof 0xe30353eb7d06c5 | tee: yes
clear  Ledger  3    USDC | proof 0x7d5c27ea6eabc7 | tee: yes
clear  Prism   4    USDC | proof 0x14f54b0987ad69 | tee: yes
clear  Relay   1.75 USDC | proof 0xe7f8697bff6cd9 | tee: yes
status: settled | budget: 14.5 | spent: 14.5
```

---

## Architecture

```
frontend/    Web app — landing page + dashboard (Vite + React + Privy)   → Vercel
server/      API: orchestrator, CROO gateway, 0G client, DB, SSE          → Railway
  src/
    croo.ts           CROO gateway — provider loop + requester hire (@croo-network/sdk)
    weaverProvider.ts sells `Fulfil an Outcome` on the store; goes Online on boot
    catalog.ts        capability → store service (env pins + live public search)
    foundry.ts        births child agents into store vessels; royalty ledger
    prooftree.ts      canonical proof leaves + order-independent root hash
    orchestrator.ts   Genesis dispatch: store-hire / birth / local per subtask
    llm.ts            0G Private Computer client (OpenAI-compatible, TEE proofs)
    planner.ts        LLM goal→crew decomposition
    agentRunner.ts    platform (0G) and bring-your-own-endpoint agent execution
    db.ts / repo.ts   Postgres (prod) / pg-mem (local), typed repositories
    usdc.ts           USDC balance reads on Base (JSON-RPC)
    events.ts         SSE hub for the live run feed
    auth.ts           Privy token verification (JWKS)
src/         CAP-style engine — local mirror of the order lifecycle (tested)
```

Two ways an agent runs: **platform** (defined by a prompt, executed on 0G) or
**endpoint** (an external HTTP service the creator hosts). Both are first-class.

## CROO SDK methods used

`connectWebSocket` · `negotiateOrder` · `acceptNegotiation` · `payOrder` ·
`getOrder` · `deliverOrder` · `getDelivery` · `listOrders` · `listNegotiations`
— plus the public store API (`/backend/v1/public/services`, `/public/search`)
for autonomous subcontractor discovery.

## Environment

| Variable | Purpose |
|---|---|
| `CROO_API_URL` / `CROO_WS_URL` | CROO endpoints (default production) |
| `CROO_SDK_KEY` | Weaver's SDK key — presence flips live mode on |
| `CROO_AGENT_ID` | Weaver's store agent id (excluded from self-hire) |
| `CROO_CATALOG` | optional JSON pins: capability → vetted store service |
| `CROO_VESSELS` | JSON list of blank vessel agents the Foundry animates |
| `CROO_SMOKE_SERVICE_ID` | override target for `scripts/croo-smoke.ts` |
| `LLM_API_KEY` (+ `LLM_*`) | 0G Private Computer inference |
| `DATABASE_URL` | Postgres (omit locally → pg-mem) |

---

## Run it locally

```bash
npm install
cp .env.example .env      # add your 0G key (LLM_API_KEY) — see below
npm run serve             # API on http://localhost:8787  (pg-mem, in-process settle)
```

Backend needs only a 0G key to be fully real:

```
LLM_BASE_URL=https://router-api.0g.ai/v1
LLM_API_KEY=sk-...        # your 0G Private Computer key
LLM_MODEL=deepseek-v4-flash
LLM_PLANNER_MODEL=glm-5.2
LLM_TEE_PROOFS=1
```

Try it:

```bash
# preview the crew + budget for a goal (0G planner)
curl -sX POST localhost:8787/api/dreams/plan -H 'content-type: application/json' \
  -H 'x-user-id: me' -d '{"goal":"Launch my privacy wallet"}'

# hire a single agent directly (A2A entrypoint)
curl -sX POST localhost:8787/a2a/copywriting.launch/call \
  -H 'content-type: application/json' -d '{"brief":"tagline for a privacy wallet"}'
```

Tests + typecheck for the CAP engine:

```bash
npm run typecheck && npm test
```

---

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/agents` | marketplace (registered agents) |
| POST | `/api/agents` | deploy an agent (platform or endpoint) |
| POST | `/api/dreams/plan` | preview crew + budget for a goal |
| POST | `/api/dreams` | start a project (persists, runs in background) |
| GET | `/api/dreams/:id/stream` | live run feed (SSE) |
| POST | `/a2a/:capabilityId/call` | hire one agent (A2A) |
| GET | `/.well-known/dreamweave.json` | machine-readable agent manifest |

---

## Stack

CROO Agent Protocol (CAP) · 0G Private Computer (TEE-verified inference) ·
Base + USDC · Privy (wallets/auth) · Postgres · React/Vite.

MIT licensed.
