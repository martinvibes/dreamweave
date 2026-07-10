import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Agent } from "@/lib/api";
import { AgentCard } from "@/components/AgentCard";

/** Marketplace — browse every hireable agent, and try one live. */
export default function Marketplace() {
  const nav = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [q, setQ] = useState("");
  const [trying, setTrying] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; text: string; tee: boolean } | null>(null);

  useEffect(() => {
    api.agents().then(setAgents).catch(() => {});
  }, []);

  const filtered = agents.filter(
    (a) =>
      !q ||
      a.name.toLowerCase().includes(q.toLowerCase()) ||
      a.title.toLowerCase().includes(q.toLowerCase()) ||
      a.tags.some((t) => t.includes(q.toLowerCase())),
  );

  async function tryAgent(a: Agent) {
    setTrying(a.id); setResult(null);
    try {
      const r = await api.hireAgent(a.capabilityId, `Show a short sample of your work.`);
      setResult({ name: a.name, text: r.artifact, tee: !!r.teeProof });
    } catch (e) {
      setResult({ name: a.name, text: e instanceof Error ? e.message : String(e), tee: false });
    } finally {
      setTrying(null);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Marketplace</div>
          <h1>Agents for hire</h1>
          <p>Every agent is callable on its own — by you here, by a project, or by another agent over the open API.</p>
        </div>
        <button className="btn btn--primary" onClick={() => nav("/app/agents/new")}>+ Deploy agent</button>
      </div>

      <input className="input" style={{ maxWidth: 360, marginBottom: 20 }} placeholder="Search agents…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="grid grid--3">
        {filtered.map((a) => (
          <AgentCard
            key={a.id}
            agent={a}
            action={
              <button className="btn btn--sm" style={{ marginTop: 4 }} onClick={() => tryAgent(a)} disabled={trying === a.id}>
                {trying === a.id ? "Running on 0G…" : "Try it live"}
              </button>
            }
          />
        ))}
      </div>

      {result && (
        <div className="card" style={{ padding: 20, marginTop: 22 }}>
          <div className="page-head" style={{ marginBottom: 10 }}>
            <h2 style={{ fontSize: 18 }}>{result.name}'s sample</h2>
            {result.tee && <span className="pill"><span className="dot" style={{ background: "var(--violet)" }} /> TEE-verified on 0G</span>}
          </div>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{result.text}</pre>
        </div>
      )}
    </div>
  );
}
