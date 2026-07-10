/**
 * API client — thin typed wrapper over the DreamWeave backend.
 *
 * In dev, Vite proxies /api and /a2a to http://localhost:8787 (see vite.config).
 * In prod, set VITE_API_BASE to the Railway URL.
 *
 * Auth: we send the Privy access token as a Bearer when available; the backend
 * verifies it (prod) or accepts x-user-id (dev). getToken is injected by the
 * AuthProvider so this module stays framework-agnostic.
 */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

let tokenGetter: () => Promise<string | null> = async () => null;
let devUserId: string | null = null;

export function configureAuth(
  getToken: () => Promise<string | null>,
  devId?: string | null,
) {
  tokenGetter = getToken;
  devUserId = devId ?? null;
}

async function headers(extra: Record<string, string> = {}) {
  const h: Record<string, string> = { "content-type": "application/json", ...extra };
  const token = await tokenGetter();
  if (token) h["authorization"] = `Bearer ${token}`;
  if (devUserId) h["x-user-id"] = devUserId;
  return h;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: await headers((init?.headers as Record<string, string>) ?? {}),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// --- types (mirror the server's JSON views) ---

export interface Agent {
  id: string;
  did: string;
  name: string;
  capabilityId: string;
  title: string;
  priceUsdc: string;
  priceUnits: string;
  tags: string[];
  reputation: number;
  runtime: "platform" | "endpoint";
  jobsDone: number;
  earnedUsdc: string;
  owner: string;
}

export interface CrewMember {
  capabilityId: string;
  brief: string;
  agent: Agent | null;
}

export interface Plan {
  goal: string;
  planner: "llm" | "heuristic";
  totalUsdc: string;
  totalUnits: string;
  crew: CrewMember[];
}

export interface DreamSummary {
  id: string;
  goal: string;
  budgetUsdc: string;
  spentUsdc: string;
  status: string;
  createdAt: string;
}

export interface Task {
  id: string;
  sellerName: string;
  capabilityId: string;
  priceUsdc: string;
  phase: string;
  proofHash: string | null;
  teeProof: string | null;
  settlementRef: string | null;
  txHash: string | null;
  artifact: string | null;
}

export interface DreamDetail {
  id: string;
  goal: string;
  status: string;
  budgetUsdc: string;
  spentUsdc: string;
  threads: Task[];
}

export interface Stats {
  agents: number;
  dreams: number;
  cleared: number;
  settledUsdc: string;
}

// --- endpoints ---

export const api = {
  health: () => req<{ ok: boolean; llm: boolean; onchain: boolean; db: string }>("/health"),
  stats: () => req<Stats>("/api/stats"),
  agents: (capabilityId?: string) =>
    req<{ agents: Agent[] }>(
      `/api/agents${capabilityId ? `?capabilityId=${encodeURIComponent(capabilityId)}` : ""}`,
    ).then((r) => r.agents),

  createAgent: (input: {
    name: string;
    capabilityId: string;
    title?: string;
    priceUsdc: string;
    tags?: string[];
    runtime: "platform" | "endpoint";
    systemPrompt?: string;
    endpointUrl?: string;
    payoutAddress?: string;
  }) => req<{ agent: Agent }>("/api/agents", { method: "POST", body: JSON.stringify(input) }),

  planProject: (goal: string) =>
    req<Plan>("/api/dreams/plan", { method: "POST", body: JSON.stringify({ goal }) }),

  startProject: (goal: string, budgetUsdc?: string) =>
    req<{ id: string; goal: string; budgetUsdc: string; streamUrl: string }>("/api/dreams", {
      method: "POST",
      body: JSON.stringify({ goal, ...(budgetUsdc ? { budgetUsdc } : {}) }),
    }),

  myProjects: () => req<{ dreams: DreamSummary[] }>("/api/dreams").then((r) => r.dreams),
  project: (id: string) => req<DreamDetail>(`/api/dreams/${id}`),

  hireAgent: (capabilityId: string, brief: string) =>
    req<{
      agent: string;
      priceUsdc: string;
      resultHash: string;
      teeProof: string | null;
      model: string | null;
      artifact: string;
    }>(`/a2a/${encodeURIComponent(capabilityId)}/call`, {
      method: "POST",
      body: JSON.stringify({ brief }),
    }),

  streamUrl: (id: string) => `${BASE}/api/dreams/${id}/stream`,
};
