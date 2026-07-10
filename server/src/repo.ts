/**
 * Repositories — typed data access over the Db. Plain parameterised SQL; no ORM
 * so what runs is exactly what you read. Rows use snake_case columns mapped to
 * camelCase domain objects. USDC amounts are BIGINT in the DB and bigint in JS.
 */

import { getDb } from "./db.js";

// --- domain types -----------------------------------------------------------

export type AgentRuntime = "platform" | "endpoint";

export interface AgentRow {
  id: string;
  owner: string;
  did: string;
  name: string;
  capabilityId: string;
  title: string;
  priceUsdc: bigint;
  tags: string[];
  reputation: number;
  runtime: AgentRuntime;
  systemPrompt: string | null;
  endpointUrl: string | null;
  payoutAddress: string | null;
  jobsDone: number;
  earnedUsdc: bigint;
  parentId: string | null;
  crooServiceId: string | null;
  createdAt: string;
}

export type DreamStatus =
  | "planning"
  | "funded"
  | "weaving"
  | "settled"
  | "closed"
  | "failed";

export interface DreamRow {
  id: string;
  owner: string;
  goal: string;
  budgetUsdc: bigint;
  spentUsdc: bigint;
  status: DreamStatus;
  chainDreamId: bigint | null;
  txOpen: string | null;
  txClose: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ThreadPhase =
  | "planned"
  | "match"
  | "negotiate"
  | "lock"
  | "deliver"
  | "clear"
  | "void";

export interface ThreadRow {
  id: string;
  dreamId: string;
  agentId: string;
  sellerName: string;
  capabilityId: string;
  brief: string;
  priceUsdc: bigint;
  phase: ThreadPhase;
  capOrderId: string | null;
  artifact: string | null;
  proofHash: string | null;
  teeProof: string | null;
  settlementRef: string | null;
  txHash: string | null;
  idx: number;
  createdAt: string;
  updatedAt: string;
}

// --- mappers ----------------------------------------------------------------

function toBig(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  return BigInt(String(v ?? "0"));
}

function mapAgent(r: Record<string, unknown>): AgentRow {
  return {
    id: String(r.id),
    owner: String(r.owner),
    did: String(r.did),
    name: String(r.name),
    capabilityId: String(r.capability_id),
    title: String(r.title),
    priceUsdc: toBig(r.price_usdc),
    tags: safeTags(r.tags),
    reputation: Number(r.reputation),
    runtime: (r.runtime as AgentRuntime) ?? "platform",
    systemPrompt: (r.system_prompt as string) ?? null,
    endpointUrl: (r.endpoint_url as string) ?? null,
    payoutAddress: (r.payout_address as string) ?? null,
    jobsDone: Number(r.jobs_done ?? 0),
    earnedUsdc: toBig(r.earned_usdc),
    parentId: (r.parent_id as string) ?? null,
    crooServiceId: (r.croo_service_id as string) ?? null,
    createdAt: String(r.created_at),
  };
}

function safeTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  try {
    const parsed = JSON.parse(String(v ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function mapDream(r: Record<string, unknown>): DreamRow {
  return {
    id: String(r.id),
    owner: String(r.owner),
    goal: String(r.goal),
    budgetUsdc: toBig(r.budget_usdc),
    spentUsdc: toBig(r.spent_usdc),
    status: (r.status as DreamStatus) ?? "planning",
    chainDreamId: r.chain_dream_id != null ? toBig(r.chain_dream_id) : null,
    txOpen: (r.tx_open as string) ?? null,
    txClose: (r.tx_close as string) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapThread(r: Record<string, unknown>): ThreadRow {
  return {
    id: String(r.id),
    dreamId: String(r.dream_id),
    agentId: String(r.agent_id),
    sellerName: String(r.seller_name),
    capabilityId: String(r.capability_id),
    brief: String(r.brief),
    priceUsdc: toBig(r.price_usdc),
    phase: (r.phase as ThreadPhase) ?? "planned",
    capOrderId: (r.cap_order_id as string) ?? null,
    artifact: (r.artifact as string) ?? null,
    proofHash: (r.proof_hash as string) ?? null,
    teeProof: (r.tee_proof as string) ?? null,
    settlementRef: (r.settlement_ref as string) ?? null,
    txHash: (r.tx_hash as string) ?? null,
    idx: Number(r.idx ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// --- users ------------------------------------------------------------------

export async function upsertUser(id: string, wallet?: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO users (id, wallet) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET wallet = COALESCE(EXCLUDED.wallet, users.wallet)`,
    [id, wallet ?? null],
  );
}

// --- agents -----------------------------------------------------------------

export interface NewAgent {
  id: string;
  owner: string;
  did: string;
  name: string;
  capabilityId: string;
  title: string;
  priceUsdc: bigint;
  tags: string[];
  reputation?: number;
  runtime: AgentRuntime;
  systemPrompt?: string | null;
  endpointUrl?: string | null;
  payoutAddress?: string | null;
  parentId?: string | null;
  crooServiceId?: string | null;
}

export async function createAgent(a: NewAgent): Promise<AgentRow> {
  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO agents
       (id, owner, did, name, capability_id, title, price_usdc, tags,
        reputation, runtime, system_prompt, endpoint_url, payout_address,
        parent_id, croo_service_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      a.id,
      a.owner,
      a.did,
      a.name,
      a.capabilityId,
      a.title,
      a.priceUsdc.toString(),
      JSON.stringify(a.tags),
      a.reputation ?? 50,
      a.runtime,
      a.systemPrompt ?? null,
      a.endpointUrl ?? null,
      a.payoutAddress ?? null,
      a.parentId ?? null,
      a.crooServiceId ?? null,
    ],
  );
  return mapAgent(rows[0]!);
}

export async function listAgents(capabilityId?: string): Promise<AgentRow[]> {
  const db = await getDb();
  const { rows } = capabilityId
    ? await db.query(
        `SELECT * FROM agents WHERE capability_id = $1 ORDER BY reputation DESC`,
        [capabilityId],
      )
    : await db.query(`SELECT * FROM agents ORDER BY reputation DESC, created_at DESC`);
  return rows.map(mapAgent);
}

export async function getAgent(id: string): Promise<AgentRow | undefined> {
  const db = await getDb();
  const { rows } = await db.query(`SELECT * FROM agents WHERE id = $1`, [id]);
  return rows[0] ? mapAgent(rows[0]) : undefined;
}

/** Pick the best-rated agent offering a capability (discovery / matching). */
export async function bestAgentFor(
  capabilityId: string,
): Promise<AgentRow | undefined> {
  const matches = await listAgents(capabilityId);
  return matches[0];
}

export async function recordAgentEarning(
  id: string,
  amount: bigint,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE agents SET jobs_done = jobs_done + 1,
        earned_usdc = earned_usdc + $2,
        reputation = LEAST(100, reputation + 1)
     WHERE id = $1`,
    [id, amount.toString()],
  );
}

// --- dreams -----------------------------------------------------------------

export async function createDream(d: {
  id: string;
  owner: string;
  goal: string;
  budgetUsdc: bigint;
}): Promise<DreamRow> {
  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO dreams (id, owner, goal, budget_usdc) VALUES ($1,$2,$3,$4) RETURNING *`,
    [d.id, d.owner, d.goal, d.budgetUsdc.toString()],
  );
  return mapDream(rows[0]!);
}

export async function getDream(id: string): Promise<DreamRow | undefined> {
  const db = await getDb();
  const { rows } = await db.query(`SELECT * FROM dreams WHERE id = $1`, [id]);
  return rows[0] ? mapDream(rows[0]) : undefined;
}

export async function listDreams(owner: string): Promise<DreamRow[]> {
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT * FROM dreams WHERE owner = $1 ORDER BY created_at DESC`,
    [owner],
  );
  return rows.map(mapDream);
}

export async function updateDream(
  id: string,
  patch: Partial<{
    status: DreamStatus;
    spentUsdc: bigint;
    chainDreamId: bigint;
    txOpen: string;
    txClose: string;
  }>,
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (patch.status !== undefined) (sets.push(`status = $${i++}`), vals.push(patch.status));
  if (patch.spentUsdc !== undefined)
    (sets.push(`spent_usdc = $${i++}`), vals.push(patch.spentUsdc.toString()));
  if (patch.chainDreamId !== undefined)
    (sets.push(`chain_dream_id = $${i++}`), vals.push(patch.chainDreamId.toString()));
  if (patch.txOpen !== undefined) (sets.push(`tx_open = $${i++}`), vals.push(patch.txOpen));
  if (patch.txClose !== undefined) (sets.push(`tx_close = $${i++}`), vals.push(patch.txClose));
  if (sets.length === 0) return;
  sets.push(`updated_at = now()`);
  vals.push(id);
  await db.query(`UPDATE dreams SET ${sets.join(", ")} WHERE id = $${i}`, vals);
}

// --- threads ----------------------------------------------------------------

export async function createThread(t: {
  id: string;
  dreamId: string;
  agentId: string;
  sellerName: string;
  capabilityId: string;
  brief: string;
  priceUsdc: bigint;
  idx: number;
}): Promise<ThreadRow> {
  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO threads
       (id, dream_id, agent_id, seller_name, capability_id, brief, price_usdc, idx)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      t.id,
      t.dreamId,
      t.agentId,
      t.sellerName,
      t.capabilityId,
      t.brief,
      t.priceUsdc.toString(),
      t.idx,
    ],
  );
  return mapThread(rows[0]!);
}

export async function listThreads(dreamId: string): Promise<ThreadRow[]> {
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT * FROM threads WHERE dream_id = $1 ORDER BY idx ASC`,
    [dreamId],
  );
  return rows.map(mapThread);
}

export async function updateThread(
  id: string,
  patch: Partial<{
    phase: ThreadPhase;
    capOrderId: string;
    artifact: string;
    proofHash: string;
    teeProof: string;
    settlementRef: string;
    txHash: string;
  }>,
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  const col: Record<string, string> = {
    phase: "phase",
    capOrderId: "cap_order_id",
    artifact: "artifact",
    proofHash: "proof_hash",
    teeProof: "tee_proof",
    settlementRef: "settlement_ref",
    txHash: "tx_hash",
  };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${col[k]} = $${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return;
  sets.push(`updated_at = now()`);
  vals.push(id);
  await db.query(`UPDATE threads SET ${sets.join(", ")} WHERE id = $${i}`, vals);
}

// --- platform stats ---------------------------------------------------------

export async function platformStats(): Promise<{
  agents: number;
  dreams: number;
  cleared: number;
  settledUsdc: bigint;
}> {
  const db = await getDb();
  const a = await db.query(`SELECT COUNT(*)::int AS n FROM agents`);
  const d = await db.query(`SELECT COUNT(*)::int AS n FROM dreams`);
  const c = await db.query(
    `SELECT COUNT(*)::int AS n FROM threads WHERE phase = 'clear'`,
  );
  const s = await db.query(
    `SELECT COALESCE(SUM(price_usdc),0)::text AS s FROM threads WHERE phase = 'clear'`,
  );
  return {
    agents: Number(a.rows[0]?.n ?? 0),
    dreams: Number(d.rows[0]?.n ?? 0),
    cleared: Number(c.rows[0]?.n ?? 0),
    settledUsdc: toBig(s.rows[0]?.s ?? "0"),
  };
}

// --- royalties ---------------------------------------------------------------

export const ROYALTY_BPS = 1000; // 10% to the Foundry, forever

export async function recordRoyalty(
  childAgentId: string,
  orderRef: string,
  amountUsdc: bigint,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO royalty_ledger (child_agent_id, order_ref, amount_usdc)
     VALUES ($1, $2, $3)`,
    [childAgentId, orderRef, amountUsdc.toString()],
  );
}

export async function listRoyalties(): Promise<
  { childAgentId: string; orderRef: string; amountUsdc: bigint; createdAt: string }[]
> {
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT child_agent_id, order_ref, amount_usdc, created_at
     FROM royalty_ledger ORDER BY created_at DESC`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    childAgentId: String(r.child_agent_id),
    orderRef: String(r.order_ref),
    amountUsdc: BigInt(String(r.amount_usdc)),
    createdAt: String(r.created_at),
  }));
}
