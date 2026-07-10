# DreamWeave — Build Log

> Living status doc. Updated **before and after** each work session so we always
> know exactly where we stopped. Newest session at the top of "Session history".

**Repo:** https://github.com/martinvibes/dreamweave · **Brand:** DreamWeave
**One-liner:** Hire a team of AI agents to get real work done — AI runs on **0G**,
money settles on **Base** in USDC, pay-per-verified-proof.

---

## Core concept (locked)

- **Compute = 0G.** Agents run on 0G Private Computer (TEE-verified inference).
  0G API key is ONLY for running the AI. This is our differentiator + on-theme.
- **Money = Base.** All value/escrow/settlement is USDC on **Base** (Sepolia for
  the demo). Never describe money as "on 0G".
- **Unique flow:** you don't post one task — you describe an *outcome*; an
  orchestrator plans a *team*, you fund a budget, each agent is hired via the CAP
  lifecycle and paid only after a verified delivery. Unspent budget returns.

---

## Architecture

```
frontend/   Vite + React + Privy → Vercel   (landing + dashboard, pure API client)
server/     Node API → Railway              (orchestrator, 0G client, DB, SSE, chain)
src/        CAP engine (shared, tested)      (protocol types + escrow state machine)
contracts/  DreamVault.sol                   (shared-budget multi-agent settlement on Base)
```

Key server modules: `llm.ts` (0G, OpenAI-compatible, TEE), `planner.ts`
(GLM-5.2 goal→crew), `orchestrator.ts` (CAP lifecycle + 0G exec + settle + SSE),
`agentRunner.ts` (platform/endpoint), `db.ts`+`repo.ts` (Postgres/pg-mem),
`chain.ts` (DreamVault via viem), `events.ts` (SSE), `auth.ts` (Privy JWKS).

---

## Status by area

| Area | State | Notes |
|---|---|---|
| CAP engine | ✅ done | typechecks, unit tests pass |
| 0G LLM client | ✅ done | `router-api.0g.ai/v1` confirmed; TEE trace captured |
| Planner (GLM-5.2) | ✅ done | real goal→crew decomposition verified |
| Orchestrator + SSE | ✅ works | 5 agents hired, TEE-attested, settled end-to-end |
| DB (pg-mem/Postgres) | ✅ done | same SQL local + prod |
| REST + A2A API | ✅ done | agents, plan, dreams, stream, /a2a hire |
| DreamVault contract | ✅ written | not yet deployed to Base Sepolia |
| Frontend landing | ✅ v1 | needs premium redesign (in progress) |
| Frontend dashboard | ✅ v1 | plain-language nav; needs UX polish + animations |
| Privy auth | ⚠️ wired, not working | needs debug + dashboard allowed-origins |
| Funding flow | ❌ todo | attach budget + fund embedded wallet on Base |
| On-chain settlement | ⚠️ code ready | needs DreamVault deployed + operator key |
| Deploy (Railway/Vercel) | ✅ config | not yet deployed |

---

## Known issues / TODO (active)

1. **Amount display bug** — SSE events send USDC in base units (e.g. `3250000`);
   UI showed `$3250000`. Fix: format in SSE emits. [fixing this session]
2. **Privy connect not working** — modal doesn't open. Likely allowed-origins /
   login-method config in the Privy dashboard + verify SDK version/API.
3. **UI must be world-class** — smoother animations, gorgeous loading states,
   killer completion state, light mode, more unique flow. Reference: Daydreams,
   tessera-web-six.vercel.app. [in progress]
4. **Base, not 0G, for money** — audit all copy/pills so money reads as Base.
5. **Smart funding** — after sign-in (Google/wallet), user funds the wallet we
   create; creating a project attaches a real budget on Base.
6. **Deploy DreamVault** to Base Sepolia; wire `SETTLE_ONCHAIN=1`.

---

## Secrets / env (local dev in `.env`, gitignored)

- `LLM_BASE_URL=https://router-api.0g.ai/v1`, `LLM_API_KEY=<0G key>`,
  `LLM_MODEL=deepseek-v4-flash`, `LLM_PLANNER_MODEL=glm-5.2`, `LLM_TEE_PROOFS=1`
- `PRIVY_APP_ID=cmrb1gi9b000r0cjly6tupaz7`
- Chain (Base Sepolia): `CHAIN_ID=84532`, USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- `DATABASE_URL` empty locally (pg-mem); set on Railway.

## Run locally

```bash
npm install && npm run serve         # API :8787 (real 0G, pg-mem, in-process settle)
cd frontend && npm install && npm run dev   # web :5173
```

---

## Session history

### Session 3 — UI overhaul + fixes (in progress)
- Writing this build log (per request: keep a doc updated before/after tasks).
- Fixing the amount-display bug (format USDC in SSE).
- Planned: premium UI redesign, light mode, animations, loading states, killer
  finish, funding flow, Privy fix, Base-not-0G copy.

### Session 2 — full real backend + first frontend
- Built 0G client, planner, orchestrator, DB, REST/A2A, SSE, auth, seed crew.
- Verified end-to-end: 5 agents on real 0G, TEE-attested, all settled (14.5 USDC).
- Created public repo `martinvibes/dreamweave`, pushed backend.
- Built landing + dashboard (plain-language nav), Privy wiring, deploy config.

### Session 1 — research + CAP engine
- Deep-researched CROO/CAP, Daydreams, BlindMarket.
- Built the CAP engine (types + escrow state machine) + tests + demo + DreamVault.
