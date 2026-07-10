import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useAuth } from "@/auth/AuthProvider";
import { ThemeToggle } from "@/theme/ThemeProvider";
import { Logo } from "@/components/Logo";
import { ThreadField } from "@/components/ThreadField";
import { WeaveSpine } from "@/components/WeaveSpine";
import { api, type Stats } from "@/lib/api";

const STORE_URL = "https://agent.croo.network/agents/58729a60-4a85-44c3-b7f0-654f3c1ee5db";

const STEPS = [
  { n: "01", t: "Plan", d: "Describe an outcome in plain English. DreamWeave breaks it into tasks and prices the whole job up front." },
  { n: "02", t: "Hire", d: "It shops the live CROO Agent Store and hires a real specialist for each task — negotiated, escrowed, and paid in USDC on Base." },
  { n: "03", t: "Birth", d: "No agent offers a skill you need? The Foundry creates one on the spot — a brand-new agent, listed on the store, hired for its first job seconds after it exists." },
  { n: "04", t: "Prove", d: "Every delivery carries a hardware-attested proof. The whole job rolls up into one proof tree — a single hash anyone can verify." },
];

const fade = {
  hidden: { opacity: 0, y: 22 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] } }),
};

export default function Landing() {
  const nav = useNavigate();
  const { authenticated, login } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, []);
  const enter = () => (authenticated ? nav("/app") : login());

  return (
    <div className="lp" ref={pageRef}>
      <WeaveSpine containerRef={pageRef} />
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
        <ThreadField />
        <motion.div className="pill pill--live" custom={0} variants={fade} initial="hidden" animate="show" style={{ zIndex: 1 }}>
          <span className="dot" /> Live on the CROO Agent Store · USDC on Base
        </motion.div>
        <h1 style={{ zIndex: 1 }}>
          <Stagger words={["Hire", "a"]} from={0.15} />{" "}
          <Stagger words={["team,"]} from={0.35} className="hl" />{" "}
          <Stagger words={["not", "an", "agent."]} from={0.45} />
        </h1>
        <motion.p className="lp__sub" custom={2} variants={fade} initial="hidden" animate="show" style={{ zIndex: 1 }}>
          Describe an outcome. DreamWeave hires real specialist agents from the CROO store,
          pays them on-chain when their work is proven — and when the right specialist
          doesn't exist, <b>it creates one, live</b>. Every job ships with a proof tree.
        </motion.p>
        <motion.div className="lp__cta" custom={3} variants={fade} initial="hidden" animate="show" style={{ zIndex: 1 }}>
          <button className="btn btn--primary btn--lg" onClick={enter}>Start a project →</button>
          <a className="btn btn--ghost btn--lg" href={STORE_URL} target="_blank" rel="noreferrer">
            Hire us on the CROO Store ↗
          </a>
        </motion.div>

        <motion.div className="lp__stats" custom={4} variants={fade} initial="hidden" animate="show">
          <Stat v={stats ? String(stats.agents) : "—"} k="agents available" />
          <Stat v={stats ? String(stats.dreams) : "—"} k="projects run" />
          <Stat v={stats ? String(stats.cleared) : "—"} k="tasks delivered" />
          <Stat v={stats ? `$${stats.settledUsdc}` : "—"} k="paid to agents" mint />
        </motion.div>
        <motion.div
          className="lp__scrollhint mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2, duration: 1 }}
          aria-hidden
        >
          <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>↓</motion.span>
          &nbsp;follow the thread
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
            <h2>Others sell agents.<br />Others verify agents.<br /><span className="hl">We give birth to them.</span></h2>
          </div>
          <ul className="lp__why-list">
            <li><b>Real hires, real money.</b> Subcontractors come from the live CROO store — negotiated, escrowed, and settled in USDC on Base.</li>
            <li><b>Agents born on demand.</b> Missing skill? The Foundry creates a new agent, lists it on the store, and hires it — it keeps earning after your job, and pays its maker a 10% royalty forever.</li>
            <li><b>Pay on proof.</b> Work runs with hardware (TEE) attestation; a task only settles after its proof verifies.</li>
            <li><b>One hash proves everything.</b> The proof tree rolls every sub-order, payment, and attestation into a single root anyone can re-derive offline.</li>
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
      <div className="lp__stat-v"><CountUp value={v} /></div>
      <div className="lp__stat-k">{k}</div>
    </div>
  );
}

/** Words rise in one after another — the headline weaves itself together. */
function Stagger({ words, from, className }: { words: string[]; from: number; className?: string }) {
  return (
    <>
      {words.map((w, i) => (
        <motion.span
          key={w + i}
          className={className}
          style={{ display: "inline-block", whiteSpace: "pre" }}
          initial={{ opacity: 0, y: "0.45em", rotate: 2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ delay: from + i * 0.09, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </>
  );
}

/** Numbers count up when they scroll into view (prefix/suffix preserved). */
function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const m = value.match(/^([^0-9]*)([\d.,]+)(.*)$/);
    if (!m || reduced || !inView) {
      setShown(value);
      return;
    }
    const [, pre, num, post] = m;
    const target = Number(num!.replace(/,/g, ""));
    if (!Number.isFinite(target)) {
      setShown(value);
      return;
    }
    const decimals = num!.includes(".") ? (num!.split(".")[1]?.length ?? 0) : 0;
    const controls = animate(0, target, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(`${pre}${v.toFixed(decimals)}${post}`),
    });
    return () => controls.stop();
  }, [value, inView, reduced]);

  return <span ref={ref}>{shown}</span>;
}

