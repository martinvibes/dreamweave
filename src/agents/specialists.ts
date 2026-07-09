/**
 * Specialist seller agents.
 *
 * Each is a small, self-contained agent that sells ONE capability on CAP. They
 * are deliberately deterministic (no external LLM calls) so the demo runs
 * offline and reproducibly — the point being to exercise the CAP A2A commerce
 * flow, not to showcase generation quality. In production `produce()` is where
 * you'd call your model / tool of choice; the CAP integration is unchanged.
 */

import { SellerAgent } from "./agent.js";
import type { CapClient } from "../cap/client.js";
import type { SellerDriver } from "./weaver.js";
import { usdc } from "../util/money.js";
import type { AgentDID, OrderTerms } from "../cap/types.js";

/** Writes marketing copy. */
export class CopywriterAgent extends SellerAgent {
  constructor(cap: CapClient) {
    super(cap, {
      did: "did:erc8004:copywriter.dreamweave",
      name: "Quill",
      payoutAddress: "0x0000000000000000000000000000000000C0FFEE",
      reputation: 82,
      capabilities: [
        {
          id: "copywriting.launch",
          title: "Product launch copy",
          priceUsdc: usdc("2.50"),
          tags: ["content", "marketing", "writing"],
        },
      ],
    });
  }
  produce(terms: OrderTerms): string {
    return [
      `# Launch copy`,
      ``,
      `Brief: ${terms.brief}`,
      ``,
      `Headline: "Stop dreaming. Start shipping."`,
      `Sub: DreamWeave turns a one-line dream into a coordinated team of agents`,
      `that discover, hire, and pay each other on-chain — settlement included.`,
    ].join("\n");
  }
}

/** Produces a visual concept / art direction spec. */
export class DesignerAgent extends SellerAgent {
  constructor(cap: CapClient) {
    super(cap, {
      did: "did:erc8004:designer.dreamweave",
      name: "Prism",
      payoutAddress: "0x0000000000000000000000000000000000DE519A",
      reputation: 77,
      capabilities: [
        {
          id: "design.keyvisual",
          title: "Key visual concept",
          priceUsdc: usdc("4.00"),
          tags: ["design", "creative", "marketing"],
        },
      ],
    });
  }
  produce(terms: OrderTerms): string {
    return [
      `# Key visual concept`,
      `Brief: ${terms.brief}`,
      `Direction: terminal-green on near-black, pixel display type,`,
      `a woven mesh motif ("dream" threads converging into a single ledger line").`,
      `Deliverables: hero, 3 social cuts, 1 animated loop.`,
    ].join("\n");
  }
}

/** Compiles research with cited sources. */
export class ResearcherAgent extends SellerAgent {
  constructor(cap: CapClient) {
    super(cap, {
      did: "did:erc8004:researcher.dreamweave",
      name: "Sage",
      payoutAddress: "0x00000000000000000000000000000000005EA6E5",
      reputation: 88,
      capabilities: [
        {
          id: "research.market",
          title: "Market snapshot with sources",
          priceUsdc: usdc("3.25"),
          tags: ["research", "intelligence", "data"],
        },
      ],
    });
  }
  produce(terms: OrderTerms): string {
    return [
      `# Market snapshot`,
      `Brief: ${terms.brief}`,
      `Finding: agent-commerce infra is consolidating on ERC-8004 identity +`,
      `USDC-on-Base settlement; CAP adds a proof-gated escrow lifecycle.`,
      `Sources: cap.croo.network; docs.croo.network; base.org.`,
    ].join("\n");
  }
}

/** Schedules and packages a distribution plan. */
export class DistributorAgent extends SellerAgent {
  constructor(cap: CapClient) {
    super(cap, {
      did: "did:erc8004:distributor.dreamweave",
      name: "Relay",
      payoutAddress: "0x000000000000000000000000000000000D152418",
      reputation: 71,
      capabilities: [
        {
          id: "distribution.plan",
          title: "Channel distribution plan",
          priceUsdc: usdc("1.75"),
          tags: ["marketing", "ops", "distribution"],
        },
      ],
    });
  }
  produce(terms: OrderTerms): string {
    return [
      `# Distribution plan`,
      `Brief: ${terms.brief}`,
      `Cadence: teaser (D-3), launch thread (D0), demo clip (D+1),`,
      `AMA in CROO Discord (D+2). Primary: X + Farcaster. Metric: qualified calls.`,
    ].join("\n");
  }
}

/** Convenience: instantiate the full specialist roster. */
export function specialistRoster(cap: CapClient): SellerAgent[] {
  return [
    new ResearcherAgent(cap),
    new CopywriterAgent(cap),
    new DesignerAgent(cap),
    new DistributorAgent(cap),
  ];
}

/**
 * A SellerDriver backed by in-process seller objects. It routes the Weaver's
 * accept/deliver calls to the right seller by DID. Over a network this same
 * interface would be implemented as RPC to independently-hosted agents.
 */
export function localSellerDriver(sellers: SellerAgent[]): SellerDriver {
  const byDid = new Map<AgentDID, SellerAgent>(sellers.map((s) => [s.did, s]));
  const find = (did: AgentDID): SellerAgent => {
    const s = byDid.get(did);
    if (!s) throw new Error(`no local seller for ${did}`);
    return s;
  };
  return {
    async accept(orderId, sellerDid) {
      await find(sellerDid).acceptOrder(orderId);
    },
    async deliver(orderId, sellerDid) {
      await find(sellerDid).deliverFor(orderId);
    },
  };
}
