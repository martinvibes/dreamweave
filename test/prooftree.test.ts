import { test } from "node:test";
import assert from "node:assert/strict";
import { leafHash, computeRoot, type ProofLeaf } from "../server/src/prooftree.js";

const leafA: ProofLeaf = {
  orderId: "ord-1",
  serviceId: "svc-1",
  agent: "Sage",
  role: "hired",
  deliverableHash: "0xaaa",
  payTxHash: "0xtx1",
};
const leafB: ProofLeaf = {
  orderId: "ord-2",
  serviceId: "svc-2",
  agent: "Nova",
  role: "born",
  deliverableHash: "0xbbb",
  teeAttestation: "tee-proof-xyz",
};

test("leafHash is deterministic and key-order independent", () => {
  const shuffled = {
    role: leafA.role,
    agent: leafA.agent,
    orderId: leafA.orderId,
    deliverableHash: leafA.deliverableHash,
    payTxHash: leafA.payTxHash,
    serviceId: leafA.serviceId,
  } as ProofLeaf;
  assert.equal(leafHash(leafA), leafHash(shuffled));
  assert.match(leafHash(leafA), /^0x[0-9a-f]+$/);
});

test("computeRoot is order-independent and input-sensitive", () => {
  const r1 = computeRoot([leafA, leafB]);
  const r2 = computeRoot([leafB, leafA]);
  assert.equal(r1, r2);
  assert.notEqual(r1, computeRoot([leafA]));
});

test("computeRoot of empty list is 0x0", () => {
  assert.equal(computeRoot([]), "0x0");
});
