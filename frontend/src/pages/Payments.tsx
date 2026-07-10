import { useEffect, useMemo, useState } from "react";
import { api, type DreamSummary, type DreamDetail } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";

/** Payments — every payout across your projects. */
export default function Payments() {
  const { authenticated, login, ready } = useAuth();
  const [details, setDetails] = useState<DreamDetail[]>([]);

  useEffect(() => {
    if (!authenticated) return;
    api.myProjects().then(async (list: DreamSummary[]) => {
      const full = await Promise.all(list.map((p) => api.project(p.id).catch(() => null)));
      setDetails(full.filter(Boolean) as DreamDetail[]);
    });
  }, [authenticated]);

  const payments = useMemo(() => {
    const rows: { project: string; seller: string; amount: string; phase: string; tx?: string | null; tee: boolean }[] = [];
    for (const d of details)
      for (const t of d.threads)
        if (t.phase === "clear")
          rows.push({ project: d.goal, seller: t.sellerName, amount: t.priceUsdc, phase: t.phase, tx: t.txHash, tee: !!t.teeProof });
    return rows;
  }, [details]);

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  if (ready && !authenticated) {
    return <div className="gate"><h2>Connect to see payments</h2><button className="btn btn--primary" onClick={login}>Connect</button></div>;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Payments</div>
          <h1>Payments</h1>
          <p>Every payout to an agent — released only after a verified delivery.</p>
        </div>
        <div className="card tile tile--mint" style={{ minWidth: 160 }}>
          <div className="tile__v">${total.toFixed(2)}</div>
          <div className="tile__k">total paid</div>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="card empty"><h3>No payments yet</h3><p className="dim">Run a project and payouts show up here.</p></div>
      ) : (
        <div className="list">
          {payments.map((p, i) => (
            <div key={i} className="list__row">
              <div>
                <div className="list__title">{p.seller}</div>
                <div className="list__sub mono">{p.project}{p.tx ? ` · tx ${p.tx.slice(0, 14)}…` : ""}</div>
              </div>
              {p.tee ? <span className="pill"><span className="dot" style={{ background: "var(--violet)" }} /> verified</span> : <span />}
              <span className="mono" style={{ color: "var(--mint)" }}>+${p.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
