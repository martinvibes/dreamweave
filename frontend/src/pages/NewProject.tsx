import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, type Plan } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";
import { RunView } from "@/components/RunView";
import { Loader, Weaving } from "@/components/Loader";
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
        <button className="btn btn--primary btn--lg" onClick={login}>Connect</button>
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
    } catch (e) { setErr(msg(e)); } finally { setLoading(false); }
  }

  async function start() {
    if (!plan) return;
    setLoading(true); setErr(null);
    try {
      const res = await api.startProject(plan.goal);
      setProjectId(res.id);
      setStage("run");
    } catch (e) { setErr(msg(e)); } finally { setLoading(false); }
  }

  if (stage === "run" && projectId) {
    return (
      <div>
        <div className="page-head">
          <div>
            <div className="eyebrow">{run.done ? "Project delivered" : "Project running"}</div>
            <h1>{plan?.goal}</h1>
          </div>
          {run.done && <button className="btn" onClick={() => nav(`/app/projects/${projectId}`)}>View results →</button>}
        </div>
        <RunView run={run} />
      </div>
    );
  }


  return (
    <div>
      <div className="np-hero">
        <div className="eyebrow">New project</div>
        <h1>What do you want done?</h1>
        <p>Describe the outcome in a sentence. We'll assemble a team of agents and show you the plan and price before anything runs.</p>

        <div className="np-input">
          <textarea className="textarea" placeholder="e.g. Launch my app to the CROO community this week"
            value={goal} onChange={(e) => setGoal(e.target.value)} disabled={stage === "review" || loading}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") preview(); }} />
        </div>
        <div className="chips">
          {EXAMPLES.map((x) => <span key={x} className="chip" onClick={() => setGoal(x)}>{x}</span>)}
        </div>

        {err && <p style={{ color: "var(--coral)", marginTop: 14 }} className="mono">{err}</p>}

        {stage === "compose" && !loading && (
          <div style={{ marginTop: 22 }}>
            <button className="btn btn--primary btn--lg" onClick={preview} disabled={!goal.trim()}>
              Plan the team →
            </button>
          </div>
        )}
        {stage === "compose" && loading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 30 }}>
            <Weaving
              size={170}
              lines={[
                "reading your goal…",
                "splitting it into tasks…",
                "shopping the CROO store…",
                "checking who exists — and who doesn't…",
                "pricing the team…",
              ]}
            />
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {stage === "review" && plan && (
          <motion.div className="plan" style={{ marginTop: 30 }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Proposed team{plan.planner === "llm" ? " · planned by 0G" : ""}
            </div>
            <h2 style={{ fontSize: 24, marginBottom: 12 }}>{plan.crew.length} agents for this project</h2>

            {plan.crew.map((c, i) => (
              <motion.div key={i} className="plan__row"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
                <div className="plan__badge">{c.agent?.name.charAt(0) ?? "?"}</div>
                <div className="plan__who">
                  <b>{c.agent?.name ?? "Unmatched"}</b> <span className="dim mono">· {c.capabilityId}</span>
                  <p>{c.brief}</p>
                </div>
                <div className="plan__price">${c.agent?.priceUsdc ?? "—"}</div>
              </motion.div>
            ))}

            <div className="plan__total">
              <div>
                <div className="eyebrow">Spend cap for this run</div>
                <div className="big">${plan.totalUsdc} <span className="dim mono" style={{ fontSize: 14 }}>USDC</span></div>
              </div>
              <div className="row" style={{ flex: "0 0 auto", gap: 10 }}>
                <button className="btn" onClick={() => setStage("compose")} disabled={loading}>Back</button>
                <button className="btn btn--primary btn--lg" onClick={start} disabled={loading}>
                  {loading ? <Loader /> : "Approve & run →"}
                </button>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Paid from the agent's own wallet, one task at a time — each only after its delivery
              proof verifies. Unspent budget is never charged.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
