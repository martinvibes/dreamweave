/**
 * DreamWeave demo — end-to-end A2A commerce on CAP.
 *
 *   npm run demo
 *
 * Runs entirely in the `sim` CAP backend (no gas, no keys). It:
 *   1. registers 4 specialist seller agents + 1 Weaver on CAP;
 *   2. funds the Weaver with USDC;
 *   3. gives the Weaver a one-line "dream";
 *   4. the Weaver discovers, hires, escrows, verifies and settles with each
 *      specialist through CAP's Negotiate->Lock->Deliver->Clear lifecycle;
 *   5. prints a settlement ledger + the anti-sybil metrics judges look for.
 *
 * In production the same lifecycle runs on CROO's rails via @croo-network/sdk
 * (real CAP orders, USDC on Base) — no agent code changes.
 */

import { SimCapClient } from "./cap/sim.js";
import { specialistRoster, localSellerDriver } from "./agents/specialists.js";
import { WeaverAgent } from "./agents/weaver.js";
import type { SellerAgent } from "./agents/agent.js";
import { formatUsdc, usdc } from "./util/money.js";
import { OrderPhase } from "./cap/types.js";

const GOAL =
  process.argv.slice(2).join(" ") ||
  "Launch DreamWeave to the CROO community this week";

function line(char = "─", n = 64): string {
  return char.repeat(n);
}

async function main(): Promise<void> {
  const cap = new SimCapClient();

  // Register specialists (L1 identity + L2 capabilities).
  const sellers: SellerAgent[] = specialistRoster(cap);
  for (const s of sellers) await s.register();

  // The Weaver drives hired sellers through a decoupled SellerDriver — exactly
  // how independent agents interact on CAP (here, in-process; over a network,
  // RPC to independently-hosted agents).
  const driver = localSellerDriver(sellers);
  const byDid = new Map(sellers.map((s) => [s.did, s]));

  const log = (event: string, data?: Record<string, unknown>) => {
    const suffix = data ? " " + JSON.stringify(data) : "";
    console.log(`  · ${event}${suffix}`);
  };

  const weaver = new WeaverAgent(cap, driver, log);
  await weaver.register();

  // Fund the buyer with USDC (sim). On-chain this is the buyer's real balance.
  cap.fund(weaver.did, usdc("100"));

  console.log(line("═"));
  console.log("  DREAMWEAVE — agentic commerce on CAP (sim backend)");
  console.log(line("═"));
  console.log(`  Dream: "${GOAL}"`);
  console.log(`  Weaver budget: ${formatUsdc(cap.balanceOf(weaver.did))} USDC`);
  console.log(line());

  const report = await weaver.weave(GOAL);

  console.log(line());
  console.log("  SETTLEMENT LEDGER");
  console.log(line());
  for (const hire of report.hires) {
    const seller = byDid.get(hire.seller as SellerAgent["did"])!;
    const status = hire.order.phase === OrderPhase.Clear ? "CLEARED" : hire.order.phase.toUpperCase();
    console.log(
      `  ${status.padEnd(8)} ${seller.name.padEnd(8)} ` +
        `${formatUsdc(hire.order.terms.priceUsdc).padStart(6)} USDC  ` +
        `${hire.subtask.capabilityId}`,
    );
  }
  console.log(line());

  console.log("  PAYOUTS (escrow released on verified proof)");
  for (const s of sellers) {
    const bal = cap.balanceOf(s.did);
    if (bal > 0n) console.log(`  ${s.name.padEnd(8)} +${formatUsdc(bal)} USDC`);
  }
  console.log(`  Weaver   -${formatUsdc(usdc("100") - cap.balanceOf(weaver.did))} USDC (spent)`);
  console.log(line());

  console.log("  ANTI-SYBIL / COMPOSABILITY METRICS");
  console.log(`  unique counterparty agents : ${report.uniqueSellers}  (target ≥ 3)`);
  console.log(`  orders cleared             : ${report.cleared}`);
  console.log(`  orders voided              : ${report.voided}`);
  console.log(`  total settled              : ${formatUsdc(report.totalSpentUsdc)} USDC`);
  console.log(line("═"));

  if (report.uniqueSellers < 3) {
    console.error("  WARNING: fewer than 3 unique counterparties — sybil flag risk.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
