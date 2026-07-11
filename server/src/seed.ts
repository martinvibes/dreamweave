/**
 * Seed — publish the founding crew so a fresh database (or in-memory pg-mem)
 * has real, hireable agents on first boot. These are platform-run agents that
 * execute on 0G. Users can deploy their own alongside them.
 */

import { createAgent, listAgents } from "./repo.js";
import { usdc } from "../../src/index.js";

const CREW = [
  {
    id: "seed-sage",
    did: "did:erc8004:researcher.dreamweave",
    name: "Sage",
    capabilityId: "research.market",
    title: "Market snapshot with sources",
    priceUsdc: usdc("0.12"),
    tags: ["research", "intelligence", "data"],
    reputation: 88,
    payoutAddress: "0x00000000000000000000000000000000005EA6E5",
    systemPrompt:
      "You are Sage, a research analyst. Produce a tight market snapshot: 3-5 " +
      "concrete findings with named sources, and one clear recommendation.",
  },
  {
    id: "seed-quill",
    did: "did:erc8004:copywriter.dreamweave",
    name: "Quill",
    capabilityId: "copywriting.launch",
    title: "Product launch copy",
    priceUsdc: usdc("0.10"),
    tags: ["content", "marketing", "writing"],
    reputation: 82,
    payoutAddress: "0x0000000000000000000000000000000000C0FFEE",
    systemPrompt:
      "You are Quill, a launch copywriter. Deliver a headline, subhead, and 3 " +
      "punchy body lines ready to ship. No filler.",
  },
  {
    id: "seed-prism",
    did: "did:erc8004:designer.dreamweave",
    name: "Prism",
    capabilityId: "design.keyvisual",
    title: "Key visual concept",
    priceUsdc: usdc("0.15"),
    tags: ["design", "creative", "marketing"],
    reputation: 77,
    payoutAddress: "0x0000000000000000000000000000000000DE519A",
    systemPrompt:
      "You are Prism, an art director. Deliver a key-visual concept: art " +
      "direction, palette, type, and a shot list for hero + 3 social cuts.",
  },
  {
    id: "seed-relay",
    did: "did:erc8004:distributor.dreamweave",
    name: "Relay",
    capabilityId: "distribution.plan",
    title: "Channel distribution plan",
    priceUsdc: usdc("0.08"),
    tags: ["marketing", "ops", "distribution"],
    reputation: 71,
    payoutAddress: "0x000000000000000000000000000000000D152418",
    systemPrompt:
      "You are Relay, a growth strategist. Deliver a channel-by-channel launch " +
      "cadence with timing and one success metric per channel.",
  },
  {
    id: "seed-ledger",
    did: "did:erc8004:analyst.dreamweave",
    name: "Ledger",
    capabilityId: "defi.monitor",
    title: "On-chain ops brief",
    priceUsdc: usdc("0.12"),
    tags: ["defi", "onchain", "monitoring"],
    reputation: 80,
    payoutAddress: "0x0000000000000000000000000000000000A11CE0",
    systemPrompt:
      "You are Ledger, an on-chain analyst. Deliver a concise ops brief: key " +
      "risks, metrics to watch, and alert thresholds for the given goal.",
  },
] as const;

export async function seedCrew(): Promise<void> {
  const existing = await listAgents();
  if (existing.length > 0) return;
  for (const a of CREW) {
    await createAgent({
      id: a.id,
      owner: "dreamweave:platform",
      did: a.did,
      name: a.name,
      capabilityId: a.capabilityId,
      title: a.title,
      priceUsdc: a.priceUsdc,
      tags: [...a.tags],
      reputation: a.reputation,
      runtime: "platform",
      systemPrompt: a.systemPrompt,
      payoutAddress: a.payoutAddress,
    });
  }
}
