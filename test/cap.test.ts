/**
 * CAP lifecycle tests — verify the SimCapClient enforces the real protocol
 * state machine and money rules, so agent code is exercised against genuine
 * constraints (not a permissive mock).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { SimCapClient } from "../src/cap/sim.js";
import { OrderPhase, type AgentCard } from "../src/cap/types.js";
import { makeProof, expectArtifactHash } from "../src/cap/proof.js";
import { usdc } from "../src/util/money.js";

const buyer: AgentCard = {
  did: "did:erc8004:buyer.test",
  name: "Buyer",
  payoutAddress: "0xbuyer",
  reputation: 90,
  capabilities: [],
};

const seller: AgentCard = {
  did: "did:erc8004:seller.test",
  name: "Seller",
  payoutAddress: "0xseller",
  reputation: 80,
  capabilities: [
    {
      id: "work.do",
      title: "Do work",
      priceUsdc: usdc("5"),
      tags: ["work"],
    },
  ],
};

function fixture() {
  const cap = new SimCapClient();
  return cap;
}

const terms = () => ({
  capabilityId: "work.do",
  brief: "do the thing",
  priceUsdc: usdc("5"),
  deadline: Number.MAX_SAFE_INTEGER,
});

test("happy path: negotiate -> lock -> deliver -> clear releases escrow", async () => {
  const cap = fixture();
  await cap.register(buyer);
  await cap.register(seller);
  cap.fund(buyer.did, usdc("10"));

  let order = await cap.negotiate(buyer.did, seller.did, terms());
  assert.equal(order.phase, OrderPhase.Negotiate);

  await cap.accept(order.id, seller.did);
  order = await cap.lock(order.id, buyer.did);
  assert.equal(order.phase, OrderPhase.Lock);
  assert.equal(order.escrowedUsdc, usdc("5"));
  assert.equal(cap.balanceOf(buyer.did), usdc("5"), "buyer debited into escrow");
  assert.equal(cap.balanceOf(seller.did), 0n, "seller not yet paid");

  const artifact = "the delivered work";
  const proof = makeProof(artifact);
  order = await cap.deliver(order.id, seller.did, proof);
  assert.equal(order.phase, OrderPhase.Deliver);

  order = await cap.clear(order.id, buyer.did, expectArtifactHash(artifact));
  assert.equal(order.phase, OrderPhase.Clear);
  assert.equal(cap.balanceOf(seller.did), usdc("5"), "seller paid on clear");
  assert.equal(order.escrowedUsdc, 0n);
  assert.ok(order.settlementRef?.startsWith("sim-settle-"));
});

test("no proof, no payment: failed verification voids + refunds buyer", async () => {
  const cap = fixture();
  await cap.register(buyer);
  await cap.register(seller);
  cap.fund(buyer.did, usdc("10"));

  let order = await cap.negotiate(buyer.did, seller.did, terms());
  await cap.accept(order.id, seller.did);
  await cap.lock(order.id, buyer.did);
  await cap.deliver(order.id, seller.did, makeProof("wrong artifact"));

  // Buyer expected a different artifact -> verification fails.
  order = await cap.clear(order.id, buyer.did, expectArtifactHash("the real artifact"));
  assert.equal(order.phase, OrderPhase.Void);
  assert.equal(cap.balanceOf(seller.did), 0n, "seller NOT paid");
  assert.equal(cap.balanceOf(buyer.did), usdc("10"), "buyer fully refunded");
});

test("phase guards: cannot lock before negotiate exists / cannot clear before deliver", async () => {
  const cap = fixture();
  await cap.register(buyer);
  await cap.register(seller);
  cap.fund(buyer.did, usdc("10"));

  const order = await cap.negotiate(buyer.did, seller.did, terms());
  // clear before deliver
  await assert.rejects(
    () => cap.clear(order.id, buyer.did, () => true),
    /expected deliver/,
  );
  // deliver before lock
  await assert.rejects(
    () => cap.deliver(order.id, seller.did, makeProof("x")),
    /expected lock/,
  );
});

test("insufficient funds blocks lock", async () => {
  const cap = fixture();
  await cap.register(buyer);
  await cap.register(seller);
  cap.fund(buyer.did, usdc("1")); // less than 5

  const order = await cap.negotiate(buyer.did, seller.did, terms());
  await cap.accept(order.id, seller.did);
  await assert.rejects(() => cap.lock(order.id, buyer.did), /insufficient USDC/);
});

test("wrong party cannot act on an order", async () => {
  const cap = fixture();
  await cap.register(buyer);
  await cap.register(seller);
  cap.fund(buyer.did, usdc("10"));

  const order = await cap.negotiate(buyer.did, seller.did, terms());
  // seller cannot lock (only buyer funds escrow)
  await assert.rejects(() => cap.lock(order.id, seller.did), /not the buyer/);
});

test("discovery ranks by reputation and filters by capability", async () => {
  const cap = fixture();
  await cap.register(seller);
  await cap.register({
    ...seller,
    did: "did:erc8004:seller2.test",
    name: "Seller2",
    reputation: 95,
  });
  const found = await cap.discover({ capabilityId: "work.do" });
  assert.equal(found.length, 2);
  assert.equal(found[0]!.reputation, 95, "highest reputation first");

  const none = await cap.discover({ capabilityId: "does.not.exist" });
  assert.equal(none.length, 0);
});
