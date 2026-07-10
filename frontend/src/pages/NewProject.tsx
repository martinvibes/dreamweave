import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, type Plan } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";
import { RunView } from "@/components/RunView";
import { Loader } from "@/components/Loader";
import { useRun } from "@/lib/useRun";

const EXAMPLES = [
  "Launch my privacy-first crypto wallet to the CROO community",
  "Research the AI agent market and write a launch plan",
  "Create a full go-to-market kit for a DeFi app",
];

const FAUCET = "https://faucet.circle.com/"; // Base Sepolia test USDC

type Stage = "compose" | "review" | "run";

export default function NewProject() {
  const nav = useNavigate();
  const { authenticated, login, ready, wallet } = useAuth();
  const [goal, setGoal] = useState("");
  const [stage, setStage] = useState<Stage>("compose");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [showFund, setShowFund] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = useRun(projectId);

  useEffect(() => {
    if (wallet) api.walletBalance(wallet).then((b) => setBalance(b.balanceUsdc)).catch(() => setBalance("0"));
  }, [wallet, stage]);

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

  function copyAddr() {
    if (!wallet) return;
    navigator.clipboard?.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

  const budget = plan ? Number(plan.totalUsdc) : 0;
  const bal = balance != null ? Number(balance) : null;
  const funded = bal != null && bal >= budget;

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

        {stage === "compose" && (
          <div style={{ marginTop: 22 }}>
            <button className="btn btn--primary btn--lg" onClick={preview} disabled={loading || !goal.trim()}>
              {loading ? <Loader /> : "Plan the team →"}
            </button>
          </div>
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

            {/* funding */}
            <div className="card fund" style={{ marginTop: 20 }}>
              <div className="fund__bal">
                <b>${plan.totalUsdc}</b>
                <span>budget · your balance {bal != null ? `$${balance}` : "…"} USDC on Base</span>
              </div>
              <div className="row" style={{ flex: "0 0 auto", gap: 10, alignItems: "center" }}>
                <span className={`pill ${funded ? "pill--live" : ""}`}>
                  <span className="dot" style={funded ? { background: "var(--mint)" } : { background: "var(--amber)" }} />
                  {funded ? "wallet funded" : "demo settles instantly"}
                </span>
                <button className="btn btn--sm" onClick={() => setShowFund((s) => !s)}>Fund wallet</button>
              </div>
            </div>

            <AnimatePresence>
              {showFund && (
                <motion.div className="card" style={{ padding: 18, marginBottom: 8 }}
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Fund your wallet (Base Sepolia)</div>
                  <p className="dim" style={{ fontSize: 14, marginBottom: 12 }}>
                    Send test USDC to your address, or grab some free from the faucet. Agents are paid from this balance on Base.
                  </p>
                  <div className="row" style={{ alignItems: "center" }}>
                    <code className="input mono" style={{ flex: 2 }}>{wallet ?? "connect a wallet"}</code>
                    <button className="btn btn--sm" style={{ flex: "0 0 auto" }} onClick={copyAddr}>{copied ? "Copied ✓" : "Copy"}</button>
                    <a className="btn btn--sm" style={{ flex: "0 0 auto" }} href={FAUCET} target="_blank" rel="noreferrer">Get test USDC ↗</a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="plan__total">
              <div>
                <div className="eyebrow">Total budget</div>
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
              Funds are held until each agent delivers a verified result on 0G. Anything not spent returns to you.
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
