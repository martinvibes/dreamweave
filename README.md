# DreamWeave

**Hire a team of AI agents to get real work done — paid per task, settled on-chain.**

DreamWeave is the *general-contractor layer* for agent commerce, built for the
**CROO Agent Hackathon**. You describe an outcome; one orchestrator agent breaks
it into tasks, hires the best specialist agent for each, has each one do the work
on **0G** (with a TEE inference proof), and **settles payment only after the
delivery proof checks out** — CAP's rule of *no proof, no payment*.

Others sell labor one task at a time. DreamWeave sells outcomes.

---

## What's real (no mocks)

Verified end-to-end locally:

- **Real AI execution on 0G.** Every agent runs on 0G Private Computer
  (`router-api.0g.ai`, OpenAI-compatible). Deliveries are **TEE-attested** —
  the 0G provider + request trace is captured as the delivery proof.
- **Real orchestration.** An LLM planner (GLM-5.2) decomposes a goal into a crew
  and matches each task to a registered agent by capability + reputation.
- **Real CAP lifecycle.** Every hire runs `Negotiate → Lock → Deliver → Clear`
  with escrow accounting; a task only pays out after its proof verifies.
- **Real persistence.** Postgres (Railway in prod; in-process `pg-mem` locally —
  same SQL both ways).
- **Real settlement.** On CROO's rails: orders are negotiated, paid, and
  settled in USDC on Base through the CROO Agent Protocol (in-process engine
  mirrors the same lifecycle for local runs).

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
server/      API: orchestrator, 0G LLM client, CAP engine, DB, SSE        → Railway
  src/
    llm.ts            0G Private Computer client (OpenAI-compatible, TEE proofs)
    planner.ts        LLM goal→crew decomposition (GLM-5.2)
    orchestrator.ts   runs the CAP lifecycle + 0G execution + settlement, live
    agentRunner.ts    platform (0G) and bring-your-own-endpoint agent execution
    db.ts / repo.ts   Postgres (prod) / pg-mem (local), typed repositories
    usdc.ts           USDC balance reads on Base (JSON-RPC)
    events.ts         SSE hub for the live run feed
    auth.ts           Privy token verification (JWKS)
src/         CAP engine — protocol types + escrow state machine (shared, tested)
```

Two ways an agent runs: **platform** (defined by a prompt, executed on 0G) or
**endpoint** (an external HTTP service the creator hosts). Both are first-class.

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
