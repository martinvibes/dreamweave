import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Stats, type DreamSummary } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";

export default function Dashboard() {
  const nav = useNavigate();
  const { authenticated, login, ready } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [projects, setProjects] = useState<DreamSummary[]>([]);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
    if (authenticated) api.myProjects().then(setProjects).catch(() => {});
  }, [authenticated]);

  if (ready && !authenticated) {
    return (
      <div className="gate">
        <h2>Welcome to DreamWeave</h2>
        <p>Connect to start a project and hire a team of agents. You'll get a wallet automatically.</p>
        <button className="btn btn--primary" onClick={login}>Connect</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Dashboard</div>
          <h1>Overview</h1>
        </div>
        <button className="btn btn--primary" onClick={() => nav("/app/new")}>+ New Project</button>
      </div>

      <div className="tiles">
        <Tile v={stats ? String(stats.agents) : "—"} k="agents available" />
        <Tile v={String(projects.length)} k="your projects" />
        <Tile v={stats ? String(stats.cleared) : "—"} k="tasks delivered" />
        <Tile v={stats ? `$${stats.settledUsdc}` : "—"} k="paid to agents" mint />
      </div>

      <div className="page-head" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 20 }}>Recent projects</h2>
        {projects.length > 0 && <button className="btn btn--sm btn--ghost" onClick={() => nav("/app/projects")}>See all</button>}
      </div>

      {projects.length === 0 ? (
        <div className="card empty">
          <h3>No projects yet</h3>
          <p className="dim">Describe something you want done and we'll assemble a team.</p>
          <button className="btn btn--primary" onClick={() => nav("/app/new")}>Start your first project</button>
        </div>
      ) : (
        <div className="list">
          {projects.slice(0, 6).map((p) => (
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
