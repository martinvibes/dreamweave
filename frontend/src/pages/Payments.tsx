import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api, type DreamSummary, type DreamDetail } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";

interface RoyaltyRow {
  childAgentId: string;
  childName: string;
  orderRef: string;
  amountUsdc: string;
  createdAt: string;
}

/** Payments — every payout across your projects. */
export default function Payments() {
  const { authenticated, login, ready } = useAuth();
  const [details, setDetails] = useState<DreamDetail[]>([]);
  const [royalties, setRoyalties] = useState<RoyaltyRow[]>([]);

  useEffect(() => {
    if (!authenticated) return;
    api.myProjects().then(async (list: DreamSummary[]) => {
      const full = await Promise.all(list.map((p) => api.project(p.id).catch(() => null)));
      setDetails(full.filter(Boolean) as DreamDetail[]);
    });
    api.royalties().then(setRoyalties).catch(() => {});
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

      <div className="page-head" style={{ marginTop: 44 }}>
        <div>
          <div className="eyebrow">Royalties</div>
          <h2 style={{ fontSize: 26 }}>Earnings from created agents</h2>
          <p>Agents this platform created keep working after your project ends — and send back 10% of everything they earn.</p>
        </div>
        {royalties.length > 0 && (
          <div className="card tile" style={{ minWidth: 160 }}>
            <div className="tile__v" style={{ color: "var(--amber)" }}>
              ${royalties.reduce((s, r) => s + Number(r.amountUsdc), 0).toFixed(2)}
            </div>
            <div className="tile__k">royalties earned</div>
          </div>
        )}
      </div>

      {royalties.length === 0 ? (
        <div className="card empty">
          <h3>No royalties yet</h3>
          <p className="dim">When a project needs a skill no agent offers, a new agent is created and listed — every job it takes afterwards pays a royalty here.</p>
        </div>
      ) : (
        <div className="list">
          {royalties.map((r, i) => (
            <motion.div
              key={r.childAgentId + r.orderRef}
              className="list__row"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div>
                <div className="list__title">{r.childName}</div>
                <div className="list__sub mono">order {r.orderRef.slice(0, 12)}… · {new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <span className="royalty-flow" aria-hidden>
                <span /><span /><span />
              </span>
              <span className="mono" style={{ color: "var(--amber)" }}>+${r.amountUsdc}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
