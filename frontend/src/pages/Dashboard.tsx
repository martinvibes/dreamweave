import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type DreamSummary } from "@/lib/api";
import { SkeletonRows, SkeletonTiles } from "@/components/Loader";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
const STORE_URL = "https://agent.croo.network/agents/58729a60-4a85-44c3-b7f0-654f3c1ee5db";

interface ProofTotals {
  orders: number;
  completed: number;
  uniqueCounterparties: number;
  uniqueBuyerWallets: number;
  agentsBorn: number;
  royaltiesUsdc: string;
}

/** Overview — what the agent has been doing, at a glance. */
export default function Dashboard() {
  const nav = useNavigate();
  const [totals, setTotals] = useState<ProofTotals | null>(null);
  const [runs, setRuns] = useState<DreamSummary[] | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/proof`)
      .then((r) => r.json())
      .then((d) => setTotals(d.totals))
      .catch(() => {});
    api.myProjects().then(setRuns).catch(() => setRuns([]));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Overview</div>
          <h1>The agent at work</h1>
          <p>
            DreamWeave sells one service on the{" "}
            <a href={STORE_URL} target="_blank" rel="noreferrer" style={{ color: "var(--amber)" }}>
              CROO store ↗
            </a>{" "}
            — it hires real specialists to deliver it, and creates new ones when none exist.
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => nav("/app/new")}>▶ Run a goal</button>
      </div>

      <div className="tiles">
        {totals ? (
          <>
            <Tile v={String(totals.orders)} k="CROO orders" />
            <Tile v={String(totals.completed)} k="completed" />
            <Tile v={String(totals.uniqueCounterparties)} k="counterparty agents" />
            <Tile v={String(totals.agentsBorn)} k="agents born" mint />
            <Tile v={`$${totals.royaltiesUsdc}`} k="royalties earned" mint />
          </>
        ) : (
          <SkeletonTiles n={5} />
        )}
      </div>

      <div className="page-head" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 20 }}>Recent runs</h2>
        {(runs?.length ?? 0) > 0 && (
          <button className="btn btn--sm btn--ghost" onClick={() => nav("/app/projects")}>See all</button>
        )}
      </div>

      {runs === null ? (
        <SkeletonRows n={3} />
      ) : runs.length === 0 ? (
        <div className="card empty">
          <h3>No runs on this device yet</h3>
          <p className="dim">
            Give the agent a goal and watch it plan, hire, and — when a skill is missing — create
            the specialist live. Jobs bought by others on the store appear on the public proof page.
          </p>
          <button className="btn btn--primary" onClick={() => nav("/app/new")}>Run your first goal</button>
        </div>
      ) : (
        <div className="list">
          {(runs ?? []).slice(0, 6).map((p) => (
            <div key={p.id} className="list__row" onClick={() => nav(`/app/projects/${p.id}`)} style={{ cursor: "pointer" }}>
              <div>
                <div className="list__title">{p.goal}</div>
                <div className="list__sub mono">{p.id}</div>
              </div>
              <span className={`ph ph--${p.status === "settled" ? "clear" : "lock"}`}>{p.status}</span>
              <span className="mono" style={{ color: "var(--mint)" }}>${p.spentUsdc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({ v, k, mint }: { v: string; k: string; mint?: boolean }) {
  return (
    <div className={`card tile${mint ? " tile--mint" : ""}`}>
      <div className="tile__v">{v}</div>
      <div className="tile__k">{k}</div>
    </div>
  );
}
