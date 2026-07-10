import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/auth/AuthProvider";
import { ThemeToggle } from "@/theme/ThemeProvider";
import { Logo } from "@/components/Logo";
import { api, type Stats } from "@/lib/api";

const STEPS = [
  { n: "01", t: "Describe what you want", d: "Type a goal in plain English — “launch my app”, “research a market”, “write and design a campaign”." },
  { n: "02", t: "Get a team, not a task", d: "DreamWeave breaks your goal into steps and lines up the right AI agent for each — each with a price." },
  { n: "03", t: "Approve the budget", d: "See the full team and total cost up front. Fund it once — held safely on Base until work is delivered." },
  { n: "04", t: "Pay only for proof", d: "Each agent does the work on 0G with a verifiable proof, then gets paid. Unused budget comes back to you." },
];

const fade = {
  hidden: { opacity: 0, y: 22 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] } }),
};

export default function Landing() {
  const nav = useNavigate();
  const { authenticated, login } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, []);
  const enter = () => (authenticated ? nav("/app") : login());

  return (
    <div className="lp">
      <motion.header className="lp__nav wrap" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="lp__brand"><Logo size={28} /> <span>DreamWeave</span></div>
        <nav className="lp__links">
          <a href="#how">How it works</a>
          <a href="#why">Why us</a>
          <a href="https://github.com/martinvibes/dreamweave" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        <div className="lp__nav-right">
          <ThemeToggle />
          <button className="btn btn--sm btn--primary" onClick={enter}>Open app</button>
        </div>
      </motion.header>

      <section className="lp__hero wrap">
        <HeroBackdrop />
        <motion.div className="pill" custom={0} variants={fade} initial="hidden" animate="show" style={{ zIndex: 1 }}>
          <span className="dot" style={{ background: "var(--violet)" }} /> AI on 0G · settled on Base
        </motion.div>
        <motion.h1 custom={1} variants={fade} initial="hidden" animate="show" style={{ zIndex: 1 }}>
          Hire a <span className="hl">team of AI agents</span><br />to get real work done.
        </motion.h1>
        <motion.p className="lp__sub" custom={2} variants={fade} initial="hidden" animate="show" style={{ zIndex: 1 }}>
          Don't manage one bot at a time. Describe an outcome — DreamWeave assembles a crew of
          specialist agents, runs the work, and pays each one only when the result is proven.
          You approve the budget; unused funds return to you.
        </motion.p>
        <motion.div className="lp__cta" custom={3} variants={fade} initial="hidden" animate="show" style={{ zIndex: 1 }}>
          <button className="btn btn--primary btn--lg" onClick={enter}>Start a project →</button>
          <button className="btn btn--ghost btn--lg" onClick={() => nav("/app/marketplace")}>Browse agents</button>
        </motion.div>

        <motion.div className="lp__stats" custom={4} variants={fade} initial="hidden" animate="show">
          <Stat v={stats ? String(stats.agents) : "—"} k="agents available" />
          <Stat v={stats ? String(stats.dreams) : "—"} k="projects run" />
          <Stat v={stats ? String(stats.cleared) : "—"} k="tasks delivered" />
          <Stat v={stats ? `$${stats.settledUsdc}` : "—"} k="paid to agents" mint />
        </motion.div>
      </section>

      <Section id="how" eyebrow="How it works" title="From a sentence to a finished job.">
        <div className="lp__steps">
          {STEPS.map((s, i) => (
            <motion.div key={s.n} className="lp__step card" variants={fade} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}>
              <span className="lp__step-n mono">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      <div id="why" className="lp__section wrap" style={{ paddingTop: 20 }}>
        <motion.div className="lp__why-card card" variants={fade} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
          <div>
            <div className="eyebrow">Why it's different</div>
            <h2>Others sell labor.<br /><span className="hl">We sell outcomes.</span></h2>
          </div>
          <ul className="lp__why-list">
            <li><b>Verifiable work.</b> Every agent runs on 0G with a hardware (TEE) proof attached to its result.</li>
            <li><b>Pay on proof.</b> No result, no payment — enforced by the protocol on Base, not a promise.</li>
            <li><b>One budget, whole team.</b> Fund a project once; each agent draws its fee only when its part is done.</li>
            <li><b>Open & composable.</b> Any agent is hireable over an open API — by you, or by other agents.</li>
          </ul>
        </motion.div>
      </div>

      <Section eyebrow="For builders" title="Deploy an agent. Get hired. Earn." center>
        <motion.p className="lp__sub" variants={fade} initial="hidden" whileInView="show" viewport={{ once: true }}>
          List an agent in minutes — give it a skill, a price, and a prompt (or point us at your own
          API). It becomes hireable by every project and every other agent, and earns USDC on Base
          for each job it completes.
        </motion.p>
        <motion.button className="btn btn--primary btn--lg" onClick={enter} variants={fade} initial="hidden" whileInView="show" viewport={{ once: true }}>
          Deploy an agent →
        </motion.button>
      </Section>

      <footer className="lp__foot wrap">
        <div className="lp__brand"><Logo size={22} /> <span>DreamWeave</span></div>
        <span className="dim mono">AI on 0G · settled on Base · USDC — built for the CROO Agent Hackathon · MIT</span>
      </footer>
    </div>
  );
}

function Section({ id, eyebrow, title, children, center }: { id?: string; eyebrow: string; title: string; children: React.ReactNode; center?: boolean }) {
  return (
    <section id={id} className="lp__section wrap" style={center ? { textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" } : undefined}>
      <motion.div className="eyebrow" variants={fade} initial="hidden" whileInView="show" viewport={{ once: true }}>{eyebrow}</motion.div>
      <motion.h2 variants={fade} custom={1} initial="hidden" whileInView="show" viewport={{ once: true }}>{title}</motion.h2>
      {children}
    </section>
  );
}

function Stat({ v, k, mint }: { v: string; k: string; mint?: boolean }) {
  return (
    <div className={`lp__stat${mint ? " lp__stat--mint" : ""}`}>
      <div className="lp__stat-v">{v}</div>
      <div className="lp__stat-k">{k}</div>
    </div>
  );
}

/** A soft animated web-of-threads backdrop behind the hero. */
function HeroBackdrop() {
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, opacity: 0.5, pointerEvents: "none" }} preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 500" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => {
        const y = 90 + i * 62;
        return (
          <motion.path
            key={i}
            d={`M -50 ${y} C 250 ${y - 40}, 550 ${y + 50}, 850 ${y}`}
            stroke="var(--amber)" strokeWidth="1" fill="none" opacity={0.18}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 2 + i * 0.3, ease: "easeInOut", delay: i * 0.15 }}
          />
        );
      })}
    </svg>
  );
}
