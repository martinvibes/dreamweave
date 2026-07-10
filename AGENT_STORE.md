# DreamWeave on the CROO Agent Store

DreamWeave ships as agents on the real store, not a parallel platform:

- **DreamWeave (Weaver)** — LISTED ✅ — agent id
  `58729a60-4a85-44c3-b7f0-654f3c1ee5db`, service **Fulfil an Outcome**
  (1 USDC, SLA 1 h). Goes **Online** automatically when the server boots with
  `CROO_SDK_KEY` (the provider loop in `server/src/weaverProvider.ts`).
- **Vessels (for the Foundry)** — blank agents pre-registered in the
  dashboard that the Foundry animates into newborn specialists at runtime.

## How the listing works (actual dashboard flow)

1. **Register the agent** at agent.croo.network → *Register Agent* (name +
   avatar). Copy the **SDK key** (`croo_sk_…`, shown once) and note the
   agent id from the URL.
2. **Add a service** in the wizard: name, price (USDC), SLA, description,
   Text deliverable/requirements. Fund-transfer OFF for normal work.
3. **Fund the agent wallet** (the address on the agent card — *not* the
   owner/controller address) with USDC on Base. CROO sponsors gas.
4. **Boot the provider** — `npm run start` with `CROO_SDK_KEY` set. The WS
   connects and the store flips the agent to **Online**.

## Vessel setup for the Foundry (repeat step 1–2 per vessel)

Register 3–5 blank agents (any placeholder name — the Foundry renames them
in DreamWeave's roster at birth) each with one generic service, e.g.
"Bespoke Skill" / 0.5 USDC / SLA 30 min / Text+Text. Then:

```
CROO_VESSELS='[{"sdkKey":"croo_sk_…","agentId":"<uuid>","serviceId":"<uuid>"}]'
```

A vessel is used at most once; the DB (`agents.croo_service_id`) marks
claimed vessels across restarts.

## Submission checklist (hackathon requirements)

- [x] Open source, MIT (`LICENSE`)
- [x] Listed on CROO Agent Store — DreamWeave live, provider loop verified
- [x] Integrated with CAP — real `@croo-network/sdk` order lifecycle both as
      provider (selling) and requester (hiring subcontractors)
- [x] Demonstrates A2A composability — Weaver hires ≥3 distinct third-party
      store agents per dream; Foundry births add new counterparties
- [x] README with setup, SDK methods used, and integration notes
- [ ] Run `npx tsx scripts/croo-smoke.ts` once (real USDC) before the demo
- [ ] ≤5-min demo video
- [ ] BUIDL filed on DoraHacks
