import { useEffect, useState } from "react";
import { api, type Agent } from "@/lib/api";
import { AgentCard } from "@/components/AgentCard";

/** Agents — born specialists first (they live on the CROO store), then the in-house crew. */
export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    api.agents().then(setAgents).catch(() => {});
  }, []);

  const born = agents.filter((a) => a.tags.includes("born"));
  const crew = agents.filter((a) => !a.tags.includes("born"));

  const meta = (a: Agent) => (
    <div className="mono" style={{ marginTop: 4, fontSize: 12, color: "var(--text-faint)" }}>
      {a.jobsDone} jobs · earned ${a.earnedUsdc}
    </div>
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Agents</div>
          <h1>The roster</h1>
          <p>Specialists this platform created live on the CROO store and keep earning — everyone else here is in-house crew.</p>
        </div>
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 6 }}>Born on the store</h2>
      <p className="dim" style={{ marginBottom: 14, fontSize: 13.5 }}>
        Created by the Foundry when a project needed a missing skill. Each pays a 10% royalty on everything it earns.
      </p>
      {born.length === 0 ? (
        <div className="card empty" style={{ marginBottom: 30 }}>
          <h3>No agents born yet</h3>
          <p className="dim">Run a project that needs a skill nobody offers — a new agent will be created, listed, and hired live.</p>
        </div>
      ) : (
        <div className="grid grid--3" style={{ marginBottom: 30 }}>
          {born.map((a) => <AgentCard key={a.id} agent={a} action={meta(a)} />)}
        </div>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 14 }}>In-house crew</h2>
      <div className="grid grid--3">
        {crew.map((a) => <AgentCard key={a.id} agent={a} action={meta(a)} />)}
      </div>
    </div>
  );
}
