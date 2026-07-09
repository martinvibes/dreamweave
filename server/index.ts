/**
 * DreamWeave API server.
 *
 * Real backend, runs locally with zero external services (pg-mem DB, in-process
 * settlement); flips to full production (Postgres, 0G, Base Sepolia) by env.
 *
 *   Public
 *     GET  /health
 *     GET  /api/stats                 platform counters
 *     GET  /api/agents                marketplace (the crew)
 *     GET  /.well-known/dreamweave.json  machine-readable A2A manifest
 *     POST /a2a/:capabilityId/call    hire one agent (external A2A entrypoint)
 *
 *   Authed (Privy token in prod; x-user-id in dev)
 *     POST /api/agents                deploy an agent
 *     GET  /api/dreams                my dreams
 *     POST /api/dreams/plan           preview crew + budget (no charge)
 *     POST /api/dreams                cast a dream (persists, returns id)
 *     POST /api/dreams/:id/weave      start weaving (background)
 *     GET  /api/dreams/:id            dream + threads
 *     GET  /api/dreams/:id/stream     SSE live Loom feed
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { config } from "./src/config.js";
import { getDb } from "./src/db.js";
import { seedCrew } from "./src/seed.js";
import { resolveUser } from "./src/auth.js";
import { subscribe } from "./src/events.js";
import { makePlan, weaveDream } from "./src/orchestrator.js";
import { llmConfigured } from "./src/llm.js";
import { chainConfigured } from "./src/chain.js";
import { executeAgent } from "./src/agentRunner.js";
import { formatUsdc, usdc } from "../src/index.js";
import {
  createAgent,
  createDream,
  getAgent,
  getDream,
  listAgents,
  listDreams,
  listThreads,
  platformStats,
  updateDream,
  upsertUser,
  bestAgentFor,
} from "./src/repo.js";

// --- helpers ----------------------------------------------------------------

function bigintReplacer(_k: string, v: unknown): unknown {
  return typeof v === "bigint" ? v.toString() : v;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": config.publicWebOrigin,
    "access-control-allow-headers": "content-type,authorization,x-user-id,x-wallet",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(body, bigintReplacer, 2));
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function agentView(a: Awaited<ReturnType<typeof getAgent>>) {
  if (!a) return null;
  return {
    id: a.id,
    did: a.did,
    name: a.name,
    capabilityId: a.capabilityId,
    title: a.title,
    priceUsdc: formatUsdc(a.priceUsdc),
    priceUnits: a.priceUsdc.toString(),
    tags: a.tags,
    reputation: a.reputation,
    runtime: a.runtime,
    jobsDone: a.jobsDone,
    earnedUsdc: formatUsdc(a.earnedUsdc),
    owner: a.owner,
  };
}

// --- boot --------------------------------------------------------------------

await getDb();
await seedCrew();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${config.port}`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  if (method === "OPTIONS") return send(res, 204, {});

  try {
    // ---- public ----
    if (method === "GET" && path === "/health") {
      return send(res, 200, {
        ok: true,
        llm: llmConfigured(),
        onchain: chainConfigured(),
        db: (await getDb()).mode,
      });
    }

    if (method === "GET" && path === "/api/stats") {
      const s = await platformStats();
      return send(res, 200, {
        agents: s.agents,
        dreams: s.dreams,
        cleared: s.cleared,
        settledUsdc: formatUsdc(s.settledUsdc),
      });
    }

    if (method === "GET" && path === "/api/agents") {
      const cap = url.searchParams.get("capabilityId") ?? undefined;
      const agents = await listAgents(cap);
      return send(res, 200, { agents: agents.map((a) => agentView(a)) });
    }

    if (method === "GET" && path === "/.well-known/dreamweave.json") {
      const agents = await listAgents();
      return send(res, 200, manifest(agents));
    }

    // ---- A2A: hire one agent ----
    const a2a = path.match(/^\/a2a\/([^/]+)\/call$/);
    if (method === "POST" && a2a) {
      const capabilityId = decodeURIComponent(a2a[1]!);
      const agent = await bestAgentFor(capabilityId);
      if (!agent) return send(res, 404, { error: `no agent offers ${capabilityId}` });
      const b = await body(req);
      const brief = String(b.brief ?? `Fulfil ${capabilityId}`);
      const delivery = await executeAgent(agent, brief);
      return send(res, 200, {
        agent: agent.name,
        capabilityId,
        priceUsdc: formatUsdc(agent.priceUsdc),
        resultHash: delivery.resultHash,
        teeProof: delivery.teeProof ?? null,
        model: delivery.model ?? null,
        artifact: delivery.artifact,
      });
    }

    // ---- authed ----
    const user = await resolveUser(req);
    if (!user) return send(res, 401, { error: "unauthorized" });
    await upsertUser(user.id, user.wallet);

    if (method === "POST" && path === "/api/agents") {
      const b = await body(req);
      const name = String(b.name ?? "").trim();
      const capabilityId = String(b.capabilityId ?? "").trim();
      const title = String(b.title ?? name).trim();
      const priceStr = String(b.priceUsdc ?? "1.00");
      const runtime = b.runtime === "endpoint" ? "endpoint" : "platform";
      if (!name || !capabilityId) {
        return send(res, 400, { error: "name and capabilityId are required" });
      }
      let price: bigint;
      try {
        price = usdc(priceStr);
      } catch {
        return send(res, 400, { error: "invalid priceUsdc" });
      }
      const agent = await createAgent({
        id: `agent-${randomUUID().slice(0, 8)}`,
        owner: user.id,
        did: `did:erc8004:${capabilityId}.${randomUUID().slice(0, 6)}`,
        name,
        capabilityId,
        title,
        priceUsdc: price,
        tags: Array.isArray(b.tags) ? (b.tags as unknown[]).map(String) : [],
        reputation: 50,
        runtime,
        systemPrompt: runtime === "platform" ? String(b.systemPrompt ?? "") : null,
        endpointUrl: runtime === "endpoint" ? String(b.endpointUrl ?? "") : null,
        payoutAddress: b.payoutAddress ? String(b.payoutAddress) : user.wallet ?? null,
      });
      return send(res, 201, { agent: agentView(agent) });
    }

    if (method === "POST" && path === "/api/dreams/plan") {
      const b = await body(req);
      const goal = String(b.goal ?? "").trim();
      if (!goal) return send(res, 400, { error: "goal is required" });
      const { plan, crew, totalUsdc } = await makePlan(goal);
      return send(res, 200, {
        goal,
        planner: plan.planner,
        totalUsdc: formatUsdc(totalUsdc),
        totalUnits: totalUsdc.toString(),
        crew: plan.subtasks.map((s, i) => ({
          capabilityId: s.capabilityId,
          brief: s.brief,
          agent: agentView(crew[i]?.agent),
        })),
      });
    }

    if (method === "POST" && path === "/api/dreams") {
      const b = await body(req);
      const goal = String(b.goal ?? "").trim();
      if (!goal) return send(res, 400, { error: "goal is required" });
      const { plan, totalUsdc } = await makePlan(goal);
      const budget =
        b.budgetUsdc != null ? usdc(String(b.budgetUsdc)) : totalUsdc;
      const dream = await createDream({
        id: `dream-${randomUUID().slice(0, 8)}`,
        owner: user.id,
        goal,
        budgetUsdc: budget,
      });
      await updateDream(dream.id, { status: "funded" });
      // Kick off weaving in the background; client subscribes to the stream.
      void weaveDream(dream.id, plan);
      return send(res, 201, {
        id: dream.id,
        goal,
        budgetUsdc: formatUsdc(budget),
        streamUrl: `/api/dreams/${dream.id}/stream`,
      });
    }

    if (method === "GET" && path === "/api/dreams") {
      const dreams = await listDreams(user.id);
      return send(res, 200, {
        dreams: dreams.map((d) => ({
          id: d.id,
          goal: d.goal,
          budgetUsdc: formatUsdc(d.budgetUsdc),
          spentUsdc: formatUsdc(d.spentUsdc),
          status: d.status,
          createdAt: d.createdAt,
        })),
      });
    }

    const dreamStream = path.match(/^\/api\/dreams\/([^/]+)\/stream$/);
    if (method === "GET" && dreamStream) {
      return subscribe(dreamStream[1]!, res);
    }

    const dreamGet = path.match(/^\/api\/dreams\/([^/]+)$/);
    if (method === "GET" && dreamGet) {
      const dream = await getDream(dreamGet[1]!);
      if (!dream) return send(res, 404, { error: "dream not found" });
      const threads = await listThreads(dream.id);
      return send(res, 200, {
        id: dream.id,
        goal: dream.goal,
        status: dream.status,
        budgetUsdc: formatUsdc(dream.budgetUsdc),
        spentUsdc: formatUsdc(dream.spentUsdc),
        threads: threads.map((t) => ({
          id: t.id,
          sellerName: t.sellerName,
          capabilityId: t.capabilityId,
          priceUsdc: formatUsdc(t.priceUsdc),
          phase: t.phase,
          proofHash: t.proofHash,
          teeProof: t.teeProof,
          settlementRef: t.settlementRef,
          txHash: t.txHash,
          artifact: t.artifact,
        })),
      });
    }

    return send(res, 404, { error: "not found", path });
  } catch (err) {
    return send(res, 500, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

function manifest(agents: Awaited<ReturnType<typeof listAgents>>) {
  return {
    name: "DreamWeave",
    description:
      "General-contractor layer for agent commerce on CAP. Cast a dream; a Weaver hires a crew and settles each thread on verified proof.",
    protocol: "CAP",
    chain: { name: "Base", mainnet: 8453, testnet: 84532, currency: "USDC" },
    inference: { provider: "0G Private Computer", teeProofs: config.llm.teeProofs },
    a2a: {
      hire_endpoint: "/a2a/{capabilityId}/call",
      method: "POST",
      body: { brief: "string" },
    },
    agents: agents.map((a) => ({
      did: a.did,
      name: a.name,
      capabilityId: a.capabilityId,
      title: a.title,
      priceUsdc: formatUsdc(a.priceUsdc),
      reputation: a.reputation,
    })),
  };
}

server.listen(config.port, () => {
  console.log(`\n  DreamWeave API → http://localhost:${config.port}`);
  console.log(`  db=${config.databaseUrl ? "postgres" : "pg-mem"}  llm=${llmConfigured() ? "on" : "off"}  onchain=${chainConfigured() ? "on" : "off"}`);
  console.log(`  GET  /api/agents   POST /api/dreams   GET /api/dreams/:id/stream\n`);
});
