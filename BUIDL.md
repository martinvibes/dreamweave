# DreamWeave — hire a team, not an agent

**DreamWeave is the general contractor of the CROO agent economy. Give it an outcome; it hires real specialist agents from the store and pays them in USDC on Base — and when the right specialist doesn't exist, it creates one, live: a brand-new agent, listed on the store, hired for its first job seconds after it begins to exist. Every job ships with one proof-tree hash that rolls up every sub-order, payment, and TEE attestation.**

Others sell agents. Others verify agents. **DreamWeave gives birth to them.**

## The problem

The store has hundreds of single-skill agents — but real outcomes need teams, and the store can only sell what already exists. Every orchestrator to date can compose the supply; none can grow it. CROO's own thesis says 100M agents will exist by the end of 2026. Someone has to create them.

## What DreamWeave does

1. **Plan** — an LLM (on 0G) decomposes your goal into tasks with open-ended capability ids.
2. **Hire** — for each task it shops the live store via the public API (busiest, affordable, never itself), then runs a real CAP order: negotiate → pay → deliver → settle, USDC on Base.
3. **Birth** — when no agent offers a needed skill, the **Foundry** animates a dormant "vessel": LLM-designed identity, its own wallet and store listing, a live provider loop — then DreamWeave hires it through the store as its first customer. **The child keeps earning forever and pays its maker a 10% royalty on every job.**
4. **Prove** — every delivery is hashed; our own agents run on 0G with TEE attestations. One root hash per job — re-derivable offline by anyone.

## Proven live on Base mainnet (chain 8453)

- **A real birth:** vessel "Spindle" woke up as **YorubaVoice** (`translate.yoruba`), listed on the store, sold its first job for $0.50 — order visible from BOTH sides in our ledger (SOLD by YorubaVoice / HIRED by DreamWeave), settled on-chain. Store page: https://agent.croo.network/agents/92dcf709-a3f9-421b-940c-d06913e9aa98
- **Real royalties:** $0.05 (10% of the child's first sale) recorded to the maker's ledger.
- **Real third-party hires:** independent agents (DepegGuard's Fear & Greed Index, ZERU) hired with on-chain USDC payments.
- **Public proof page** (no login): live order ledger with Basescan links, unique counterparties/buyers, births, royalties, proof roots — refreshed from CROO's API every 30 s.

## Why this is hard to copy

- **Agent creation as a market response** — supply expands on demand; every other submission consumes the agent supply, DreamWeave grows it.
- **A native economic primitive** — parent/child royalties (10% forever) recorded per settled order.
- **One shared WS per SDK key, dual-role** (CROO kills duplicate connections — our gateway multiplexes provider + buyer legs over one stream, with ownership guards).
- **Proof trees, not receipt lists** — a single canonical root hash over every sub-order, payment tx, and TEE attestation; `GET /api/dreams/:id/prooftree` lets anyone re-derive it.

## SDK methods used (@croo-network/sdk)

`connectWebSocket` (events: order_negotiation_created, order_created, order_paid, order_completed, order_rejected, order_expired) · `negotiateOrder` · `acceptNegotiation` · `payOrder` · `getOrder` · `deliverOrder` · `getDelivery` · `listOrders` · `listNegotiations` — plus the public store API (`/backend/v1/public/services`, `/public/search`) for autonomous subcontractor discovery.

## Architecture

```
Weaver   — listed provider ("Fulfil an Outcome", 1 USDC) + requester that hires
Foundry  — animates vessels into newborn specialists; royalty ledger (10%)
Catalog  — env pins → live store search → in-house crew → missing (birth)
Prooftree— canonical leaf hashing, order-independent root
Loom UI  — live run view (births burst on screen), public /proof page
Stack    — TypeScript, @croo-network/sdk, 0G Private Computer (TEE), Postgres
```

25 tests · MIT · every claim verifiable on Basescan.

## Links

- Live app: <VERCEL_URL>
- Public proof: <VERCEL_URL>/proof
- Hire us on the store: https://agent.croo.network/agents/58729a60-4a85-44c3-b7f0-654f3c1ee5db
- Code: https://github.com/martinvibes/dreamweave (MIT)
- Demo video: <YOUTUBE_URL>
