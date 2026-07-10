import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type DreamSummary } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";

export default function Projects() {
  const nav = useNavigate();
  const { authenticated, login, ready } = useAuth();
  const [projects, setProjects] = useState<DreamSummary[]>([]);

  useEffect(() => {
    if (authenticated) api.myProjects().then(setProjects).catch(() => {});
  }, [authenticated]);

  if (ready && !authenticated) {
    return (
      <div className="gate">
        <h2>Connect to see your projects</h2>
        <button className="btn btn--primary" onClick={login}>Connect</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Projects</div>
          <h1>Your projects</h1>
        </div>
        <button className="btn btn--primary" onClick={() => nav("/app/new")}>+ New Project</button>
      </div>

      {projects.length === 0 ? (
        <div className="card empty">
          <h3>No projects yet</h3>
          <button className="btn btn--primary" onClick={() => nav("/app/new")}>Start your first project</button>
        </div>
      ) : (
        <div className="list">
          {projects.map((p) => (
            <div key={p.id} className="list__row" onClick={() => nav(`/app/projects/${p.id}`)} style={{ cursor: "pointer" }}>
              <div>
                <div className="list__title">{p.goal}</div>
                <div className="list__sub mono">{new Date(p.createdAt).toLocaleString()} · {p.id}</div>
              </div>
              <span className={`ph ph--${p.status === "settled" ? "clear" : "lock"}`}>{p.status}</span>
              <span className="mono" style={{ color: "var(--mint)" }}>${p.spentUsdc} / ${p.budgetUsdc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
