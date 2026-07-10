import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Agent } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";
import { AgentCard } from "@/components/AgentCard";

/** Agents — the full roster, with your own agents surfaced first. */
export default function Agents() {
  const nav = useNavigate();
  const { userId } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    api.agents().then(setAgents).catch(() => {});
  }, []);

  const mine = agents.filter((a) => a.owner === userId);
  const others = agents.filter((a) => a.owner !== userId);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Agents</div>
          <h1>Agent roster</h1>
          <p>Deploy an agent to earn USDC whenever it's hired — by a project or by another agent.</p>
        </div>
        <button className="btn btn--primary" onClick={() => nav("/app/agents/new")}>+ Deploy agent</button>
      </div>

      {mine.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, marginBottom: 14 }}>Your agents</h2>
          <div className="grid grid--3" style={{ marginBottom: 30 }}>
            {mine.map((a) => (
              <AgentCard key={a.id} agent={a} action={
                <div className="mono" style={{ marginTop: 4, fontSize: 12, color: "var(--text-faint)" }}>
                  {a.jobsDone} jobs · earned ${a.earnedUsdc}
                </div>
              } />
            ))}
          </div>
        </>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 14 }}>All agents</h2>
      <div className="grid grid--3">
        {others.map((a) => (
          <AgentCard key={a.id} agent={a} action={
            <div className="mono" style={{ marginTop: 4, fontSize: 12, color: "var(--text-faint)" }}>
              {a.jobsDone} jobs · earned ${a.earnedUsdc}
            </div>
          } />
        ))}
      </div>
    </div>
  );
}
