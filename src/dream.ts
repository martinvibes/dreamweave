/**
 * Dream decomposition.
 *
 * A "dream" is a one-line high-level goal. The Weaver splits it into subtasks,
 * each mapped to a capability that some seller agent on CAP offers. This is the
 * hook that produces genuine A2A fan-out: one buyer, many independent sellers.
 */

export interface Subtask {
  /** Capability id the subtask needs (matched against CAP discovery). */
  capabilityId: string;
  /** Concrete brief handed to the hired seller. */
  brief: string;
}

export interface Dream {
  goal: string;
  subtasks: Subtask[];
}

/**
 * A tiny, deterministic planner. In production this is where an LLM would plan;
 * here it maps a launch-style dream onto the specialist roster so the demo is
 * offline and reproducible.
 */
export function planDream(goal: string): Dream {
  return {
    goal,
    subtasks: [
      {
        capabilityId: "research.market",
        brief: `Research the landscape relevant to: ${goal}`,
      },
      {
        capabilityId: "copywriting.launch",
        brief: `Write launch copy for: ${goal}`,
      },
      {
        capabilityId: "design.keyvisual",
        brief: `Design a key visual for: ${goal}`,
      },
      {
        capabilityId: "distribution.plan",
        brief: `Plan distribution channels for: ${goal}`,
      },
    ],
  };
}
