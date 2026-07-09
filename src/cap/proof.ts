/**
 * Proof helpers.
 *
 * CAP settles on "verifiable proof of delivery". DreamWeave commits to a
 * delivered artifact with a content hash the buyer can independently recompute
 * — this is what makes settlement trust-minimized ("no proof, no payment").
 *
 * Uses a portable pure-TS SHA-256 (src/util/sha256.ts) so the identical engine
 * runs in Node (tests/CLI/server) and in the browser (the live Loom UI). The
 * 0x-prefixed hex is interchangeable with an on-chain keccak/sha commitment as
 * an opaque content hash.
 */

import { sha256Hex } from "../util/sha256.js";
import type { DeliveryProof } from "./types.js";

/** Deterministic content hash of an artifact string. */
export function hashArtifact(artifact: string): string {
  return "0x" + sha256Hex(artifact);
}

/** Build a DeliveryProof for an artifact the seller is about to deliver. */
export function makeProof(
  artifact: string,
  opts: { artifactUri?: string; attestation?: string } = {},
): DeliveryProof {
  const resultHash = hashArtifact(artifact);
  return {
    resultHash,
    // Default to an inline data uri so the demo is fully self-contained.
    artifactUri: opts.artifactUri ?? `data:text/plain,${encodeURIComponent(artifact)}`,
    attestation: opts.attestation,
  };
}

/**
 * A ProofVerifier factory: the buyer knows the artifact it expected (or can
 * re-derive it) and confirms the seller's committed hash matches. This is the
 * concrete meaning of CAP's "delivery must be verified before settlement runs".
 */
export function expectArtifactHash(expectedArtifact: string) {
  const expected = hashArtifact(expectedArtifact);
  return (_order: unknown, proof: DeliveryProof): boolean =>
    proof.resultHash === expected;
}

/**
 * A looser verifier used when the buyer cannot reproduce the artifact byte for
 * byte (e.g. creative work) but can check the proof is well-formed and the
 * committed hash actually matches the delivered artifact URI's contents.
 */
export function verifyInlineArtifact(_order: unknown, proof: DeliveryProof): boolean {
  const prefix = "data:text/plain,";
  if (!proof.artifactUri.startsWith(prefix)) {
    // Non-inline artifact: accept on well-formedness (hash present & 0x-hex).
    return /^0x[0-9a-f]{64}$/.test(proof.resultHash);
  }
  const artifact = decodeURIComponent(proof.artifactUri.slice(prefix.length));
  return hashArtifact(artifact) === proof.resultHash;
}
