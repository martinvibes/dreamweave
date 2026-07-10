/**
 * Proof tree — one verifiable fingerprint over every sub-job in a dream.
 * Leaf = one hire (store agent, born agent, or local sim run). The root
 * ships inside the Weaver's CAP delivery; anyone can re-derive it offline.
 */

import { hashArtifact } from "../../src/index.js";

export interface ProofLeaf {
  orderId: string;
  serviceId: string;
  agent: string;
  role: "hired" | "born" | "local";
  deliverableHash: string;
  payTxHash?: string;
  teeAttestation?: string;
}

/** Canonical JSON: fixed key order so hashes are stable. */
function canonical(leaf: ProofLeaf): string {
  return JSON.stringify({
    orderId: leaf.orderId,
    serviceId: leaf.serviceId,
    agent: leaf.agent,
    role: leaf.role,
    deliverableHash: leaf.deliverableHash,
    payTxHash: leaf.payTxHash ?? null,
    teeAttestation: leaf.teeAttestation ?? null,
  });
}

export function leafHash(leaf: ProofLeaf): string {
  return hashArtifact(canonical(leaf));
}

export function computeRoot(leaves: ProofLeaf[]): string {
  if (leaves.length === 0) return "0x0";
  const sorted = leaves.map(leafHash).sort();
  return hashArtifact(sorted.join("|"));
}
