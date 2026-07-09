/**
 * The Weaver's planner — turns a one-line dream into a crew plan.
 *
 * Given the goal and the capabilities actually available on the marketplace
 * (real registered agents), it asks the planner model (GLM-5.2 on 0G by default)
 * to decompose the dream into 3–5 subtasks, each mapped to an existing
 * capability. This is what makes DreamWeave an *orchestrator*, not a task board:
 * the plan, prices and crew are proposed up front for the sponsor to approve.
 *
 * Falls back to a deterministic heuristic plan if the model is unavailable or
 * returns unusable JSON, so casting a dream never hard-fails.
 */

import { complete, llmConfigured } from "./llm.js";
import { config } from "./config.js";
import type { AgentRow } from "./repo.js";

export interface PlannedSubtask {
  capabilityId: string;
  brief: string;
}

export interface CrewPlan {
  goal: string;
  subtasks: PlannedSubtask[];
  planner: "llm" | "heuristic";
}

export async function planDream(
  goal: string,
  available: AgentRow[],
): Promise<CrewPlan> {
  const caps = dedupeCaps(available);
  if (caps.length === 0) {
    return { goal, subtasks: [], planner: "heuristic" };
  }

  if (llmConfigured()) {
    try {
      const subtasks = await llmPlan(goal, caps);
      if (subtasks.length > 0) return { goal, subtasks, planner: "llm" };
    } catch {
      // fall through to heuristic
    }
  }
  return { goal, subtasks: heuristicPlan(goal, caps), planner: "heuristic" };
}

function dedupeCaps(
  agents: AgentRow[],
): { capabilityId: string; title: string }[] {
  const seen = new Map<string, string>();
  for (const a of agents) if (!seen.has(a.capabilityId)) seen.set(a.capabilityId, a.title);
  return [...seen.entries()].map(([capabilityId, title]) => ({ capabilityId, title }));
}

async function llmPlan(
  goal: string,
  caps: { capabilityId: string; title: string }[],
): Promise<PlannedSubtask[]> {
  const menu = caps
    .map((c) => `- ${c.capabilityId} : ${c.title}`)
    .join("\n");

  const res = await complete(
    [
      {
        role: "system",
        content:
          "You are the Weaver, an orchestrator that fulfils a client's goal by " +
          "hiring specialist agents. You break a goal into a minimal crew of " +
          "3-5 subtasks, each assigned to ONE available capability. Respond with " +
          "STRICT JSON only.",
      },
      {
        role: "user",
        content:
          `GOAL: ${goal}\n\n` +
          `AVAILABLE CAPABILITIES (use only these ids):\n${menu}\n\n` +
          `Return JSON of the form:\n` +
          `{"subtasks":[{"capabilityId":"<one of the ids>","brief":"<concrete instruction for that agent>"}]}\n` +
          `Rules: 3-5 subtasks, no duplicate capabilityId unless truly needed, ` +
          `each brief is specific to the goal. JSON only, no prose.`,
      },
    ],
    { temperature: 0.4, maxTokens: 1500, model: config.llm.plannerModel },
  );

  const parsed = extractJson(res.text);
  const valid = new Set(caps.map((c) => c.capabilityId));
  const out: PlannedSubtask[] = [];
  for (const s of parsed?.subtasks ?? []) {
    if (typeof s?.capabilityId === "string" && valid.has(s.capabilityId)) {
      out.push({
        capabilityId: s.capabilityId,
        brief: String(s.brief ?? `Fulfil ${s.capabilityId} for: ${goal}`),
      });
    }
  }
  return out.slice(0, 5);
}

function extractJson(text: string): { subtasks?: { capabilityId?: string; brief?: string }[] } | null {
  // Tolerate ```json fences or surrounding prose.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1]! : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Deterministic fallback: assign the goal across up to 5 available capabilities. */
function heuristicPlan(
  goal: string,
  caps: { capabilityId: string; title: string }[],
): PlannedSubtask[] {
  return caps.slice(0, 5).map((c) => ({
    capabilityId: c.capabilityId,
    brief: `${c.title} for: ${goal}`,
  }));
}
