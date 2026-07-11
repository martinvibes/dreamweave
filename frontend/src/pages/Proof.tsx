import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/theme/ThemeProvider";
import { Skeleton, SkeletonTiles } from "@/components/Loader";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
const STORE_URL = "https://agent.croo.network/agents/58729a60-4a85-44c3-b7f0-654f3c1ee5db";

interface Snapshot {
  live: boolean;
  totals: {
    orders: number;
    completed: number;
    uniqueCounterparties: number;
    uniqueBuyerWallets: number;
    agentsBorn: number;
    royaltiesUsdc: string;
  };
  orders: {
    orderId: string;
    role: "sold" | "hired";
    agent: string;
    counterpartyAgentId: string;
    priceUsdc: string;
    status: string;
    payTxHash: string | null;
    updatedTime: string;
  }[];
  births: { name: string; capabilityId: string; storeUrl: string | null }[];
  roots: { dreamId: string; root: string; leaves: number }[];
}

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  }),
};

/** Public proof — no login, no wallet. Just the receipts. */
export default function Proof() {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`${BASE}/api/proof`)
        .then((r) => r.json())
        .then(setSnap)
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const tiles = snap
    ? [
        { v: String(snap.totals.orders), k: "total orders" },
        { v: String(snap.totals.completed), k: "completed" },
        { v: String(snap.totals.uniqueCounterparties), k: "unique counterparties" },
        { v: String(snap.totals.uniqueBuyerWallets), k: "unique buyers" },
        { v: String(snap.totals.agentsBorn), k: "agents born", mint: true },
        { v: `$${snap.totals.royaltiesUsdc}`, k: "royalties earned", mint: true },
      ]
    : [];

  return (
    <div className="proof">
      <header className="lp__nav wrap">
        <Link to="/" className="lp__brand"><Logo size={26} /> <span>DreamWeave</span></Link>
        <nav className="lp__links">
          <a href={STORE_URL} target="_blank" rel="noreferrer">CROO Store ↗</a>
          <a href="https://github.com/martinvibes/dreamweave" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        <div className="lp__nav-right">
          <ThemeToggle />
          <Link className="btn btn--sm btn--primary" to="/app">Open app</Link>
        </div>
      </header>

      <div className="wrap proof__body">
        <motion.div variants={rise} initial="hidden" animate="show" className="pill pill--live">
          <span className="dot" /> live · base mainnet · refreshed every 30s
        </motion.div>
        <motion.h1 variants={rise} custom={1} initial="hidden" animate="show">Proof</motion.h1>
        <motion.p variants={rise} custom={2} initial="hidden" animate="show" className="dim proof__sub">
          Every order below is real CROO commerce — jobs DreamWeave sold, agents it hired,
          agents it <span className="hl-soft">created</span> — settled in USDC on Base.
          Don't take our word for anything: the transactions are linked.
        </motion.p>

        <div className="proof__tiles">
          {tiles.map((t, i) => (
            <motion.div
              key={t.k}
              className={`card tile${t.mint ? " tile--mint" : ""}`}
              variants={rise}
              custom={3 + i}
              initial="hidden"
              animate="show"
            >
              <div className="tile__v">{t.v}</div>
              <div className="tile__k">{t.k}</div>
            </motion.div>
          ))}
          {!snap && <SkeletonTiles n={6} />}
        </div>

        {snap && snap.births.length > 0 && (
          <motion.div variants={rise} initial="hidden" whileInView="show" viewport={{ once: true }} className="proof__births">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Born on the store</div>
            <div className="proof__birthrow">
              {snap.births.map((b) => (
                <a key={b.name} className="proof__birth card" href={b.storeUrl ?? "#"} target="_blank" rel="noreferrer">
                  <span className="proof__birthdot" aria-hidden />
                  <b>{b.name}</b>
                  <span className="mono dim">{b.capabilityId}</span>
                  {b.storeUrl && <span className="mono" style={{ color: "var(--mint)" }}>live ↗</span>}
                </a>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div variants={rise} initial="hidden" whileInView="show" viewport={{ once: true }} className="proof__ledger card">
          <div className="proof__ledgerhead mono">
            <span>order</span><span>side</span><span>agent</span><span>price</span><span>status</span><span>tx</span>
          </div>
          {(snap?.orders ?? []).map((o) => (
            <div key={o.orderId + o.role} className="proof__row mono">
              <span className="dim">{o.orderId.slice(0, 8)}…</span>
              <span className={`ptree__role ptree__role--${o.role === "sold" ? "hired" : "born"}`}>
                {o.role}
              </span>
              <span>{o.agent}</span>
              <span>${o.priceUsdc}</span>
              <span className={`ph ph--${o.status === "completed" ? "clear" : "negotiate"}`}>{o.status}</span>
              <span>
                {o.payTxHash ? (
                  <a href={`https://basescan.org/tx/${o.payTxHash}`} target="_blank" rel="noreferrer" style={{ color: "var(--sky)" }}>
                    basescan ↗
                  </a>
                ) : (
                  <span className="dim">—</span>
                )}
              </span>
            </div>
          ))}
          {!snap &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="proof__row">
                <Skeleton h={12} w={80} />
                <Skeleton h={18} w={50} r={5} />
                <Skeleton h={12} w="55%" />
                <Skeleton h={12} w={44} />
                <Skeleton h={18} w={80} r={5} />
                <Skeleton h={12} w={70} />
              </div>
            ))}
          {snap && snap.orders.length === 0 && (
            <div className="dim" style={{ padding: 20 }}>No orders yet — the loom is warming up.</div>
          )}
        </motion.div>

        {snap && snap.roots.length > 0 && (
          <motion.div variants={rise} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ marginTop: 34 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Proof-tree roots</div>
            {snap.roots.map((r) => (
              <div key={r.dreamId} className="proof__root mono">
                <span className="dim">{r.dreamId}</span>
                <span style={{ color: "var(--amber)" }}>{r.root.slice(0, 34)}…</span>
                <span className="dim">{r.leaves} receipts</span>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      <footer className="lp__foot wrap">
        <div className="lp__brand"><Logo size={22} /> <span>DreamWeave</span></div>
        <span className="dim mono">verify everything · built for the CROO Agent Hackathon · MIT</span>
      </footer>
    </div>
  );
}
