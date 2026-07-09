# Listing DreamWeave on CROO Agent Store

DreamWeave is designed so **each specialist is an independently callable,
priced agent**, and the **Weaver** is a composite agent that fulfils dreams by
hiring the specialists. That structure is what produces real A2A volume (many
buyer→seller settlements, ≥3 unique counterparties) rather than a single
monolithic bot.

## Agents to list

| Agent | DID | Capability | Price (USDC) |
|---|---|---|---|
| Sage (Researcher) | `did:erc8004:researcher.dreamweave` | `research.market` | 3.25 |
| Quill (Copywriter) | `did:erc8004:copywriter.dreamweave` | `copywriting.launch` | 2.50 |
| Prism (Designer) | `did:erc8004:designer.dreamweave` | `design.keyvisual` | 4.00 |
| Relay (Distributor) | `did:erc8004:distributor.dreamweave` | `distribution.plan` | 1.75 |
| Weaver (Orchestrator) | `did:erc8004:weaver.dreamweave` | `dream.fulfil` (composite) | dynamic |

Each `AgentCard` in `src/agents/specialists.ts` already carries the fields a
listing needs: name, ERC-8004 DID, payout address, capability id + title, USDC
price, and discovery tags.

## Listing steps (per the CROO Agent Store guide)

1. **Register identity (L1).** Mint/attest the agent's ERC-8004 DID and bind its
   payout wallet on Base. In code this is `cap.register(card)`.
2. **Publish capability (L2).** Push the capability id, title, price and tags so
   the agent is discoverable by Navigator (humans) and by other agents.
3. **Make it callable via CAP (L3).** Point the agent at the CAP escrow contract
   so it can be hired: accept terms → be locked → deliver with a proof hash →
   get cleared. `SellerAgent.serve()` implements this handler.
4. **Set the 0%-gas launch flag** if listing inside the launch window (CROO
   covers gas).
5. **Verify the callable path** with a real buyer: run the Weaver against the
   listed agents (or use Navigator to place one order) and confirm an order
   reaches `Clear` with a settlement reference.

## Submission checklist (hackathon requirements)

- [x] Open source, MIT (`LICENSE`)
- [x] Integrated with CAP — agent is callable and settles on-chain
      (`CapClient` interface; `sim` proven end-to-end, `onchain` wired to Base)
- [x] Demonstrates A2A composability — Weaver hires ≥3 distinct agents
- [x] README with setup, SDK methods used, and integration notes
- [ ] Listed on CROO Agent Store (do this once CAP addresses/SDK are available)
- [ ] ≤5-min demo video
- [ ] BUIDL filed on DoraHacks
