import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RunState, RunTask } from "@/lib/useRun";

/**
 * RunView — the live activity view. Project on the left, each hired agent on the
 * right; the connecting line animates as the task moves matched → running →
 * paid. Beside it, a plain event log and a payments list. When everything
 * finishes, a celebratory completion card slides in.
 */
export function RunView({ run }: { run: RunState }) {
  return (
    <div className="run">
      <div className="card run__stage">
        <div className="run__head">
          <span className="panel__t">Live run</span>
          <span className={`pill ${run.running ? "pill--live" : ""}`}>
            <span className="dot" style={run.done ? { background: "var(--mint)" } : undefined} />
            {run.running ? "running" : run.done ? "complete" : "idle"}
          </span>
        </div>
        <AnimatePresence mode="wait">
          {run.done ? (
            <FinishCard key="finish" run={run} />
          ) : (
            <RunGraph key="graph" tasks={run.tasks} />
          )}
        </AnimatePresence>
      </div>

      <div className="side-col">
        <div className="card panel">
          <div className="panel__head">
            <span className="panel__t">Activity</span>
            <span className="panel__t">{run.tasks.length} tasks</span>
          </div>
          <div className="feed" id="run-feed">
            {run.logs.length === 0 && (
              <div className="feed__l"><span className="feed__n">··</span><span className="feed__t dim">waiting for the team…</span></div>
            )}
            <AnimatePresence initial={false}>
              {run.logs.map((l) => (
                <motion.div key={l.id} className={`feed__l feed__l--${l.level}`}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                  <span className="feed__n">{String(l.id + 1).padStart(2, "0")}</span>
                  <span className="feed__t">{l.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="card panel">
          <div className="panel__head">
            <span className="panel__t">Payments</span>
            <span className="pay__amt">
              ${run.payments.reduce((s, p) => s + Number(p.amountUsdc || 0), 0).toFixed(2)}
            </span>
          </div>
          <div>
            {run.payments.length === 0 && (
              <div className="pay"><div className="pay__who dim">payouts appear as work is delivered</div><span /></div>
            )}
            <AnimatePresence initial={false}>
              {run.payments.map((p) => (
                <motion.div key={p.id} className="pay"
                  initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}>
                  <div className="pay__who">
                    <b>{p.sellerName}</b>
                    <span>{p.txHash ? `tx ${p.txHash.slice(0, 14)}…` : "settled on Base"}</span>
                  </div>
                  <span className="pay__amt">+${p.amountUsdc}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function RunGraph({ tasks }: { tasks: RunTask[] }) {
  const W = 640, H = 460, coreX = 96, coreY = H / 2;
  const layout = useMemo(() => {
    const n = Math.max(tasks.length, 1);
    const top = 66, bottom = H - 66;
    const step = n > 1 ? (bottom - top) / (n - 1) : 0;
    return tasks.map((t, i) => ({ t, x: W - 150, y: n > 1 ? top + step * i : H / 2 }));
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <motion.div className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <PulseGlyph />
        <h3>Assembling your team…</h3>
        <p className="dim">Agents appear here as they're hired.</p>
      </motion.div>
    );
  }

  return (
    <motion.svg className="run__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="img" aria-label="Live run graph">
      <defs>
        <radialGradient id="g-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd98a" /><stop offset="60%" stopColor="#ffb020" /><stop offset="100%" stopColor="#e8951a" />
        </radialGradient>
      </defs>

      {layout.map(({ t, x, y }) => {
        const midX = (coreX + x) / 2;
        const d = `M ${coreX} ${coreY} C ${midX} ${coreY}, ${midX} ${y}, ${x} ${y}`;
        return (
          <motion.path key={t.id} className={`gthread gthread--${t.phase}`} d={d}
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.7, ease: "easeOut" }}>
            {(t.phase === "negotiate" || t.phase === "lock" || t.phase === "deliver") && (
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.9s" repeatCount="indefinite" />
            )}
          </motion.path>
        );
      })}

      {layout.map(({ t, x, y }) =>
        t.phase === "clear" ? (
          <circle key={`c-${t.id}`} className="gcoin" r="3.4">
            <animateMotion dur="1.5s" repeatCount="indefinite"
              path={`M ${x} ${y} C ${(coreX + x) / 2} ${y}, ${(coreX + x) / 2} ${coreY}, ${coreX} ${coreY}`} />
          </circle>
        ) : null,
      )}

      <circle className="gcore" cx={coreX} cy={coreY} r="32">
        <animate attributeName="r" values="30;34;30" dur="3s" repeatCount="indefinite" />
      </circle>
      <text className="gcore-t" x={coreX} y={coreY + 4} textAnchor="middle">PROJECT</text>

      {layout.map(({ t, x, y }) => (
        <motion.g key={`n-${t.id}`} className={`gnode gnode--${t.phase}`}
          initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }} style={{ transformOrigin: `${x}px ${y}px` }}>
          <circle className="gnode__disc" cx={x} cy={y} r="25" />
          <text className="gnode__i" x={x} y={y + 5} textAnchor="middle" fontSize="15">{t.sellerName.charAt(0)}</text>
          <text className="gnode__name" x={x + 35} y={y - 2}>{t.sellerName}</text>
          <text className="gnode__meta" x={x + 35} y={y + 12}>${t.priceUsdc} · {t.phase === "clear" ? "paid" : t.phase}</text>
        </motion.g>
      ))}
    </motion.svg>
  );
}

function FinishCard({ run }: { run: RunState }) {
  const cleared = run.tasks.filter((t) => t.phase === "clear").length;
  return (
    <motion.div className="finish" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <Confetti />
      <svg className="finish__check" viewBox="0 0 80 80">
        <motion.circle cx="40" cy="40" r="34" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
        <motion.path d="M26 41 L36 51 L55 30" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.4 }} />
      </svg>
      <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>Project delivered</motion.h2>
      <motion.p className="dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        {cleared} agents finished, verified, and paid on Base.
      </motion.p>
      <motion.div className="finish__sum" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <div className="finish__stat"><b style={{ color: "var(--mint)" }}>${run.spentUsdc}</b><span>spent</span></div>
        <div className="finish__stat"><b>{cleared}</b><span>tasks paid</span></div>
        <div className="finish__stat"><b style={{ color: "var(--amber)" }}>${run.refundedUsdc}</b><span>returned</span></div>
      </motion.div>
    </motion.div>
  );
}

function Confetti() {
  const bits = Array.from({ length: 26 });
  const colors = ["var(--amber)", "var(--mint)", "var(--violet)", "var(--sky)"];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {bits.map((_, i) => {
        const left = (i * 37) % 100;
        const delay = (i % 6) * 0.08;
        const color = colors[i % colors.length];
        return (
          <motion.span key={i}
            style={{ position: "absolute", top: -10, left: `${left}%`, width: 7, height: 10, borderRadius: 2, background: color }}
            initial={{ y: -20, opacity: 0, rotate: 0 }}
            animate={{ y: 420, opacity: [0, 1, 1, 0], rotate: 360 }}
            transition={{ duration: 1.8 + (i % 4) * 0.3, delay, ease: "easeIn" }}
          />
        );
      })}
    </div>
  );
}

function PulseGlyph() {
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" aria-hidden>
      <motion.circle cx="14" cy="30" r="5" fill="var(--amber)" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }} />
      {[14, 30, 46].map((y, i) => (
        <motion.path key={y} d={`M 18 30 C 34 30, 34 ${y}, 48 ${y}`} stroke="var(--line)" strokeWidth="1.5" strokeDasharray="3 5" fill="none"
          animate={{ opacity: [0.3, 0.9, 0.3] }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2 }} />
      ))}
    </svg>
  );
}
