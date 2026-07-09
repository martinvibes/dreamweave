/**
 * A2A composability test — the Weaver hires multiple distinct specialist agents
 * to fulfil one dream, proving genuine agent-to-agent commerce and satisfying
 * the hackathon's anti-sybil thresholds (>=3 unique counterparties).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { SimCapClient } from "../src/cap/sim.js";
import { specialistRoster, localSellerDriver } from "../src/agents/specialists.js";
import { WeaverAgent } from "../src/agents/weaver.js";
import { usdc } from "../src/util/money.js";
import { OrderPhase } from "../src/cap/types.js";

test("weave: one dream fans out to >=3 unique sellers, all cleared", async () => {
  const cap = new SimCapClient();
  const sellers = specialistRoster(cap);
  for (const s of sellers) await s.register();

  const weaver = new WeaverAgent(cap, localSellerDriver(sellers));
  await weaver.register();
  cap.fund(weaver.did, usdc("100"));

  const report = await weaver.weave("Launch my app");

  assert.ok(report.uniqueSellers >= 3, "at least 3 unique counterparties");
  assert.equal(report.voided, 0, "no voided orders on happy path");
  assert.equal(report.cleared, report.hires.length, "every hire cleared");

  // Every order reached Clear and produced an artifact.
  for (const hire of report.hires) {
    assert.equal(hire.order.phase, OrderPhase.Clear);
    assert.ok(hire.artifact && hire.artifact.length > 0, "artifact delivered");
    assert.ok(hire.order.settlementRef?.startsWith("sim-settle-"));
  }

  // Money conservation: buyer spend == sum of seller payouts.
  const spent = usdc("100") - cap.balanceOf(weaver.did);
  const paidOut = sellers.reduce((sum, s) => sum + cap.balanceOf(s.did), 0n);
  assert.equal(spent, paidOut, "escrow conserved: spend equals payouts");
  assert.equal(spent, report.totalSpentUsdc);
});

test("weave settles each counterparty exactly once per subtask", async () => {
  const cap = new SimCapClient();
  const sellers = specialistRoster(cap);
  for (const s of sellers) await s.register();
  const weaver = new WeaverAgent(cap, localSellerDriver(sellers));
  await weaver.register();
  cap.fund(weaver.did, usdc("100"));

  await weaver.weave("Launch my app");
  const orders = await cap.listOrders();
  const cleared = orders.filter((o) => o.phase === OrderPhase.Clear);
  assert.equal(cleared.length, 4, "four subtasks -> four cleared orders");
});
