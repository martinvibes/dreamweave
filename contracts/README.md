# contracts/ — DreamVault

**DreamVault is the one piece of net-new on-chain infrastructure DreamWeave
adds. It complements CAP; it does not replace it.**

## Why a contract at all?

CAP already provides per-order escrow (Negotiate → Lock → Deliver → Clear) and
is our settlement rail for each individual hire. We deliberately **do not** re-
implement that — reinventing CAP's escrow would miss the whole point of the
hackathon.

What CAP doesn't give you is a **shared budget across many agents**. A dream is
one sponsor funding a *crew*: 1 budget → N sub-orders → N sellers. `DreamVault`
is the primitive for exactly that:

| Capability | CAP alone | DreamVault |
|---|---|---|
| Escrow a single order | ✅ | — (delegates to CAP) |
| Lock one budget, draw many payments | ❌ | ✅ |
| Atomic all-or-nothing multi-settle | ❌ | ✅ `settleBatch` |
| Auto-refund unspent budget to sponsor | ❌ | ✅ `closeDream` |
| On-chain weave receipt (binds sub-orders) | ❌ | ✅ events |

Each `settleThread` carries the `capOrderId` and the `proofHash` that CAP
verified, so the vault re-expresses CAP's **"no proof, no payment"** rule at the
budget level and leaves an auditable trail.

## Deploy targets

- **Base Sepolia** (chain `84532`) — testnet USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
  Free to deploy and exercise; this is how we demo real on-chain settlement
  without spending real money. (CROO doesn't advertise a testnet, but Base
  Sepolia is a public L2 testnet with faucets — this is the practical path.)
- **Base mainnet** (chain `8453`) — USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

## Build / deploy (Foundry)

```bash
# install foundry: https://book.getfoundry.sh/getting-started/installation
forge build
# deploy to Base Sepolia
forge create contracts/DreamVault.sol:DreamVault \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_KEY \
  --constructor-args 0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

The address you get back goes into `frontend`/`server` config (or `.env`
`CAP_ESCROW_ADDRESS` is joined by a `DREAMVAULT_ADDRESS`). The engine's
`OnchainCapClient` handles the per-order CAP calls; DreamVault handles the
budget envelope around them.

## Safety notes (read before trusting it)

- Checks-effects-interactions ordering on every state-changing method.
- `settled[dreamId][capOrderId]` guards against double-paying a sub-order.
- `settleBatch` is all-or-nothing (any bad payout reverts the batch).
- No owner, no upgrade proxy, no pause — nothing to rug.
- Sponsor safety hatch: after `deadline`, the sponsor can `closeDream` and
  reclaim the remainder even if the Weaver disappears.
- Not yet audited by a third party; deploy to testnet for the demo.
