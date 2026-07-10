import { test } from "node:test";
import assert from "node:assert/strict";
import { createAgent, recordRoyalty, listRoyalties, ROYALTY_BPS } from "../server/src/repo.js";

test("royalty rows accumulate per child", async () => {
  const child = await createAgent({
    id: "child-1",
    owner: "foundry",
    did: "did:erc8004:child1.dreamweave",
    name: "Nova",
    capabilityId: "translate.swahili",
    title: "Swahili translation",
    priceUsdc: 500000n,
    tags: ["born"],
    reputation: 50,
    runtime: "platform",
    systemPrompt: "You translate to Swahili.",
    endpointUrl: null,
    payoutAddress: null,
    parentId: "foundry-agent",
    crooServiceId: "svc-child-1",
  });
  assert.equal(child.parentId, "foundry-agent");
  assert.equal(child.crooServiceId, "svc-child-1");

  const share = (500000n * BigInt(ROYALTY_BPS)) / 10000n;
  await recordRoyalty(child.id, "ord-42", share);
  const rows = await listRoyalties();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.amountUsdc, 50000n); // 10% of 0.5 USDC
  assert.equal(rows[0]!.orderRef, "ord-42");
});
