import { test } from "node:test";
import assert from "node:assert/strict";

process.env.CROO_SDK_KEY = process.env.CROO_SDK_KEY || "croo_sk_test";
process.env.CROO_STORE_SEARCH = "off"; // no network in unit tests
process.env.CROO_CATALOG = JSON.stringify([
  { capabilityId: "research.market", serviceId: "svc-research", name: "ProofDesk", priceUsdc: "0.50" },
]);

const { resolveCapability, _matchService } = await import("../server/src/catalog.js");

test("env catalog resolves to a store service", async () => {
  const r = await resolveCapability("research.market");
  assert.equal(r.kind, "store");
  if (r.kind === "store") {
    assert.equal(r.serviceId, "svc-research");
    assert.equal(r.priceUsdc, 500000n); // 0.50 USDC in 6dp
  }
});

test("unknown capability with no local agent is missing", async () => {
  const r = await resolveCapability("underwater.basketweaving");
  assert.equal(r.kind, "missing");
});

test("_matchService picks keyword-matching, affordable, busiest service", () => {
  const items = [
    {
      serviceId: "s1",
      agentId: "a1",
      name: "WhaleWatch",
      description: "tracks whales",
      priceUsdc: 100000n,
      orders7d: 10,
      fundTransfer: false,
    },
    {
      serviceId: "s2",
      agentId: "a2",
      name: "Market Research Pro",
      description: "deep market research reports",
      priceUsdc: 500000n,
      orders7d: 50,
      fundTransfer: false,
    },
    {
      serviceId: "s3",
      agentId: "a3",
      name: "Research budget",
      description: "cheap research",
      priceUsdc: 90000000n, // 90 USDC — over budget cap
      orders7d: 900,
      fundTransfer: false,
    },
    {
      serviceId: "s4",
      agentId: "a4",
      name: "research swapper",
      description: "market research with fund transfer",
      priceUsdc: 100000n,
      orders7d: 999,
      fundTransfer: true, // excluded: requires principal transfer
    },
  ];
  const hit = _matchService(items, "research.market", "our-own-agent-id");
  assert.equal(hit?.serviceId, "s2");
});

test("_matchService never picks our own agent", () => {
  const items = [
    {
      serviceId: "s1",
      agentId: "me",
      name: "research",
      description: "research",
      priceUsdc: 100000n,
      orders7d: 1,
      fundTransfer: false,
    },
  ];
  assert.equal(_matchService(items, "research.market", "me"), undefined);
});
