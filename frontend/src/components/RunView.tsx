import { useMemo } from "react";
import type { RunState, RunTask } from "@/lib/useRun";

/**
 * RunView — the live activity view for a project. A simple left-to-right graph:
 * the project on the left, each hired agent on the right, the connecting line
 * changes colour as that task moves from matched → running → paid. Beside it,
 * a plain event log and a payments list.
 */
export function RunView({ run }: { run: RunState }) {
  return (
    <div className="run">
      <div className="card run__stage">
        <div className="run__head">
          <span className="panel__t">Live run</span>
          <span className={`pill ${run.running ? "pill--live" : ""}`}>
            <span className="dot" /> {run.running ? "running" : run.done ? "done" : "idle"}
          </span>
        </div>
        <RunGraph tasks={run.tasks} />
      </div>

      <div className="side-col">
        <div className="card panel">
          <div className="panel__head">
            <span className="panel__t">Activity</span>
            <span className="panel__t">{run.tasks.length} tasks</span>
          </div>
          <div className="feed" id="run-feed">
            {run.logs.length === 0 && (
              <div className="feed__l"><span className="feed__n">··</span><span className="feed__t dim">waiting…</span></div>
            )}
            {run.logs.map((l) => (
              <div key={l.id} className={`feed__l feed__l--${l.level}`}>
                <span className="feed__n">{String(l.id + 1).padStart(2, "0")}</span>
                <span className="feed__t">{l.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card panel">
          <div className="panel__head">
            <span className="panel__t">Payments</span>
            <span className="pay__amt">
              ${run.payments.reduce((s, p) => s + Number(p.amountUsdc), 0).toFixed(2)}
            </span>
          </div>
          <div>
            {run.payments.length === 0 && (
              <div className="pay"><div className="pay__who dim">payments appear as work is delivered</div><span /></div>
            )}
            {run.payments.map((p) => (
              <div key={p.id} className="pay">
                <div className="pay__who">
                  <b>{p.sellerName}</b>
                  <span>{p.txHash ? `tx ${p.txHash.slice(0, 14)}…` : (p.settlementRef || "settled")}</span>
                </div>
                <span className="pay__amt">+${p.amountUsdc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RunGraph({ tasks }: { tasks: RunTask[] }) {
  const W = 640, H = 440, coreX = 96, coreY = H / 2;
  const layout = useMemo(() => {
    const n = Math.max(tasks.length, 1);
    const top = 64, bottom = H - 64;
    const step = n > 1 ? (bottom - top) / (n - 1) : 0;
    return tasks.map((t, i) => ({ t, x: W - 150, y: n > 1 ? top + step * i : H / 2 }));
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="empty">
        <h3>No run yet</h3>
        <p className="dim">Start a project and the team assembles here in real time.</p>
      </div>
    );
  }

  return (
    <svg className="run__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Live run graph">
      <defs>
        <radialGradient id="g-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd98a" /><stop offset="60%" stopColor="#ffb020" /><stop offset="100%" stopColor="#e8951a" />
        </radialGradient>
      </defs>

      {layout.map(({ t, x, y }) => {
        const midX = (coreX + x) / 2;
        const d = `M ${coreX} ${coreY} C ${midX} ${coreY}, ${midX} ${y}, ${x} ${y}`;
        return (
          <path key={t.id} className={`gthread gthread--${t.phase}`} d={d}>
            {(t.phase === "negotiate" || t.phase === "lock" || t.phase === "deliver") && (
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.9s" repeatCount="indefinite" />
            )}
          </path>
        );
      })}

      {layout.map(({ t, x, y }) =>
        t.phase === "clear" ? (
          <circle key={`c-${t.id}`} className="gcoin" r="3.2">
            <animateMotion dur="1.5s" repeatCount="indefinite"
              path={`M ${x} ${y} C ${(coreX + x) / 2} ${y}, ${(coreX + x) / 2} ${coreY}, ${coreX} ${coreY}`} />
          </circle>
        ) : null,
      )}

      <circle className="gcore" cx={coreX} cy={coreY} r="32" />
      <text className="gcore-t" x={coreX} y={coreY + 4} textAnchor="middle">PROJECT</text>

      {layout.map(({ t, x, y }) => (
        <g key={`n-${t.id}`} className={`gnode gnode--${t.phase}`}>
          <circle className="gnode__disc" cx={x} cy={y} r="24" />
          <text className="gnode__i" x={x} y={y + 5} textAnchor="middle" fontSize="15">{t.sellerName.charAt(0)}</text>
          <text className="gnode__name" x={x + 34} y={y - 2}>{t.sellerName}</text>
          <text className="gnode__meta" x={x + 34} y={y + 12}>${t.priceUsdc} · {t.phase}</text>
        </g>
      ))}
    </svg>
  );
}
