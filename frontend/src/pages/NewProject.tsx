import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Plan } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";
import { RunView } from "@/components/RunView";
import { useRun } from "@/lib/useRun";

const EXAMPLES = [
  "Launch my privacy-first crypto wallet to the CROO community",
  "Research the AI agent market and write a launch plan",
  "Create a full go-to-market kit for a DeFi app",
];

type Stage = "compose" | "review" | "run";

export default function NewProject() {
  const nav = useNavigate();
  const { authenticated, login, ready } = useAuth();
  const [goal, setGoal] = useState("");
  const [stage, setStage] = useState<Stage>("compose");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const run = useRun(projectId);

  if (ready && !authenticated) {
    return (
      <div className="gate">
        <h2>Connect to start a project</h2>
        <p>You'll get a wallet automatically — no crypto experience needed.</p>
        <button className="btn btn--primary" onClick={login}>Connect</button>
      </div>
    );
  }

  async function preview() {
    if (!goal.trim()) return;
    setLoading(true); setErr(null);
    try {
      const p = await api.planProject(goal.trim());
      setPlan(p);
      setStage("review");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function start() {
    if (!plan) return;
    setLoading(true); setErr(null);
    try {
      const res = await api.startProject(plan.goal);
      setProjectId(res.id);
      setStage("run");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (stage === "run" && projectId) {
    return (
      <div>
        <div className="page-head">
          <div>
            <div className="eyebrow">Project running</div>
            <h1>{plan?.goal}</h1>
          </div>
          <div className="row" style={{ flex: "0 0 auto" }}>
            {run.done && (
              <button className="btn" onClick={() => nav(`/app/projects/${projectId}`)}>View results →</button>
            )}
          </div>
        </div>
        {run.done && (
          <div className="card" style={{ padding: "14px 18px", marginBottom: 20 }}>
            <span className="mono dim">
              Spent ${run.spentUsdc} of ${run.budgetUsdc} · ${run.refundedUsdc} returned to you
            </span>
          </div>
        )}
        <RunView run={run} />
      </div>
    );
  }

  return (
    <div>
      <div className="np-hero">
        <div className="eyebrow">New project</div>
        <h1>What do you want done?</h1>
        <p>Describe the outcome in a sentence. We'll line up a team of agents and show you the plan and price before anything runs.</p>

        <div className="np-input">
          <textarea
            className="textarea"
            placeholder="e.g. Launch my app to the CROO community this week"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={stage === "review" || loading}
          />
        </div>
        <div className="chips">
          {EXAMPLES.map((x) => (
            <span key={x} className="chip" onClick={() => setGoal(x)}>{x}</span>
          ))}
        </div>

        {err && <p style={{ color: "var(--coral)", marginTop: 14 }} className="mono">{err}</p>}

        {stage === "compose" && (
          <div style={{ marginTop: 22 }}>
            <button className="btn btn--primary" onClick={preview} disabled={loading || !goal.trim()}>
              {loading ? "Planning…" : "Plan the team →"}
            </button>
          </div>
        )}
      </div>

      {stage === "review" && plan && (
        <div className="plan">
          <div className="page-head" style={{ marginBottom: 8 }}>
            <div>
              <div className="eyebrow">Proposed team {plan.planner === "llm" ? "· planned by 0G" : ""}</div>
              <h2 style={{ fontSize: 24 }}>{plan.crew.length} agents for this project</h2>
            </div>
          </div>
          {plan.crew.map((c, i) => (
            <div key={i} className="plan__row">
              <div className="plan__badge">{c.agent?.name.charAt(0) ?? "?"}</div>
              <div className="plan__who">
                <b>{c.agent?.name ?? "Unmatched"}</b> <span className="dim mono">· {c.capabilityId}</span>
                <p>{c.brief}</p>
              </div>
              <div className="plan__price">${c.agent?.priceUsdc ?? "—"}</div>
            </div>
          ))}
          <div className="plan__total">
            <div>
              <div className="eyebrow">Total budget</div>
              <div className="big">${plan.totalUsdc} <span className="dim mono" style={{ fontSize: 14 }}>USDC</span></div>
            </div>
            <div className="row" style={{ flex: "0 0 auto", gap: 10 }}>
              <button className="btn" onClick={() => setStage("compose")} disabled={loading}>Back</button>
              <button className="btn btn--primary" onClick={start} disabled={loading}>
                {loading ? "Starting…" : "Approve & run →"}
              </button>
            </div>
          </div>
          <p className="hint" style={{ marginTop: 12 }}>
            Funds are held until each agent delivers a verified result. Anything not spent returns to you.
          </p>
        </div>
      )}
    </div>
  );
}
