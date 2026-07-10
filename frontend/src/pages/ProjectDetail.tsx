import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type DreamDetail, type Task } from "@/lib/api";

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState<DreamDetail | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.project(id).then(setProject).catch((e) => setErr(String(e)));
  }, [id]);

  if (err) return <div className="gate"><h2>Not found</h2><p className="mono">{err}</p></div>;
  if (!project) return <div className="gate"><p className="dim">Loading…</p></div>;

  return (
    <div>
      <button className="btn btn--sm btn--ghost" onClick={() => nav("/app/projects")} style={{ marginBottom: 16 }}>← Projects</button>
      <div className="page-head">
        <div>
          <div className="eyebrow">Project · {project.status}</div>
          <h1>{project.goal}</h1>
        </div>
        <div className="card" style={{ padding: "12px 16px" }}>
          <span className="mono dim">spent </span><span className="mono" style={{ color: "var(--mint)" }}>${project.spentUsdc}</span>
          <span className="mono dim"> / ${project.budgetUsdc}</span>
        </div>
      </div>

      <div className="list">
        {project.threads.map((t) => (
          <div key={t.id}>
            <div className="list__row" style={{ marginBottom: open === t.id ? 0 : 8, cursor: t.artifact ? "pointer" : "default" }} onClick={() => setOpen(open === t.id ? null : t.id)}>
              <div>
                <div className="list__title">{t.sellerName} <span className="dim mono" style={{ fontWeight: 400 }}>· {t.capabilityId}</span></div>
                <div className="list__sub mono">
                  {t.proofHash ? `proof ${t.proofHash.slice(0, 18)}…` : "no proof"}
                  {t.teeProof ? " · TEE-verified" : ""}
                  {t.txHash ? ` · tx ${t.txHash.slice(0, 12)}…` : ""}
                </div>
              </div>
              <span className={`ph ph--${t.phase}`}>{t.phase === "clear" ? "paid" : t.phase}</span>
              <span className="mono" style={{ color: t.phase === "clear" ? "var(--mint)" : "var(--text-dim)" }}>${t.priceUsdc}</span>
            </div>
            {open === t.id && t.artifact && (
              <div className="card" style={{ padding: 18, margin: "0 0 8px" }}>
                <Artifact task={t} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Artifact({ task }: { task: Task }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Delivered by {task.sellerName} · verified on 0G</div>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)", lineHeight: 1.65 }}>
        {task.artifact}
      </pre>
    </div>
  );
}
