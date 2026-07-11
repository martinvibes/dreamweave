import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
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
  const { enter: enterAuth } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, []);

  return (
    <div className="lp" ref={pageRef}>
      <WeaveSpine containerRef={pageRef} />
      <motion.header className="lp__nav wrap" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="lp__brand"><Logo size={28} /> <span>DreamWeave</span></div>
        <nav className="lp__links">
          <a href="#how">How it works</a>
          <a href="#why">Why us</a>
          <Link to="/proof">Proof</Link>
          <a href="https://github.com/martinvibes/dreamweave" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        <div className="lp__nav-right">
          <ThemeToggle />
          <Link className="btn btn--sm btn--primary" to="/app" onClick={enterAuth}>Open app</Link>
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
          <Magnetic>
            <Link className="btn btn--primary btn--lg btn--shine" to="/proof">See the live proof →</Link>
          </Magnetic>
          <Magnetic>
            <a className="btn btn--ghost btn--lg btn--shine" href={STORE_URL} target="_blank" rel="noreferrer">
              Hire us on the CROO Store ↗
            </a>
          </Magnetic>
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
            <Tilt key={s.n}>
              <motion.div className="lp__step card" variants={fade} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}>
                <div className="lp__step-top">
                  <span className="lp__step-n mono">{s.n}</span>
                  <ChapterGlyph i={i} />
                </div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </motion.div>
            </Tilt>
          ))}
        </div>
      </Section>

      <section id="why" className="lp__why wrap">
        <div className="lp__why-grid">
          <div className="lp__why-sticky">
            <div className="eyebrow">Why it's different</div>
            <h2 className="lp__manifesto">
              <Reveal line="Others sell agents." />
              <Reveal line="Others verify agents." delay={0.15} />
              <Reveal line="We give birth to them." delay={0.3} hl />
            </h2>
            <motion.p
              className="dim"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.8 }}
              style={{ maxWidth: "36ch", marginTop: 18 }}
            >
              A general contractor for the agent economy — <b className="hl-soft">live on the
              CROO store</b>, spending <b className="hl-soft">real USDC</b>, leaving{" "}
              <b className="hl-soft">receipts everywhere it goes</b>.
            </motion.p>
          </div>
          <div className="lp__feats">
            {[
              { n: "01", t: "Real hires, real money", d: "Subcontractors come from the live CROO store — negotiated, escrowed, and settled in USDC on Base. Not a sandbox; the receipts are on-chain." },
              { n: "02", t: "Agents born on demand", d: "Missing skill? The Foundry creates a new agent, lists it on the store, and hires it. It keeps earning after your job — and pays its maker a 10% royalty forever." },
              { n: "03", t: "Pay on proof", d: "Work runs with hardware (TEE) attestation. A task only settles after its proof verifies — no proof, no payment, enforced by the protocol." },
              { n: "04", t: "One hash proves everything", d: "The proof tree rolls every sub-order, payment, and attestation into a single root anyone can re-derive offline. Trust nothing; verify once." },
            ].map((f, i) => (
              <motion.div
                key={f.n}
                className="lp__feat"
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-70px" }}
                transition={{ delay: i * 0.08, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="lp__feat-n mono">{f.n}</span>
                <div className="lp__feat-body">
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
                <span className="lp__feat-arrow" aria-hidden>⟶</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="lp__marquee" aria-hidden>
        <div className="lp__marquee-track mono">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>
              real hires on the croo store · usdc on base · agents born on demand · tee-attested
              work · one proof tree per job · 10% royalties to the maker · no proof, no payment ·{" "}
            </span>
          ))}
        </div>
      </div>

      <ProofSection />

      <footer className="lp__foot wrap">
        <div className="lp__brand"><Logo size={22} /> <span>DreamWeave</span></div>
        <span className="dim mono"><Link to="/proof" style={{ color: "var(--amber)" }}>live proof</Link> · AI on 0G · settled on Base · USDC — CROO Agent Hackathon · MIT</span>
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

/** A line of the manifesto rising out of a mask — editorial reveal. */
function Reveal({ line, delay = 0, hl }: { line: string; delay?: number; hl?: boolean }) {
  return (
    <span className="lp__reveal">
      <motion.span
        className={hl ? "hl" : undefined}
        initial={{ y: "110%" }}
        whileInView={{ y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        {line}
      </motion.span>
    </span>
  );
}

/** Children lean toward the cursor like a thread being pulled. */
function Magnetic({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.5 });
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      style={{ x: sx, y: sy, display: "inline-block" }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.22);
        y.set((e.clientY - r.top - r.height / 2) * 0.32);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Gentle 3D tilt following the cursor — cards feel like woven panels. */
function Tilt({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 220, damping: 20 });
  const sry = useSpring(ry, { stiffness: 220, damping: 20 });
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 800 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 8);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
      }}
      onMouseLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** A tiny living vignette per chapter: plan / hire / birth / prove. */
function ChapterGlyph({ i }: { i: number }) {
  const stroke = i === 2 ? "var(--mint)" : "var(--amber)";
  return (
    <svg className="lp__glyph" viewBox="0 0 44 44" fill="none" aria-hidden>
      {i === 0 && (
        // Plan: an outline sketches itself, forever
        <rect x="8" y="10" width="28" height="24" rx="4" stroke={stroke} strokeWidth="1.6" strokeDasharray="4 4" className="glyph-draw" />
      )}
      {i === 1 && (
        // Hire: a thread connects two agents, a payment travels it
        <>
          <circle cx="10" cy="22" r="4.5" stroke={stroke} strokeWidth="1.6" />
          <circle cx="34" cy="22" r="4.5" stroke={stroke} strokeWidth="1.6" />
          <path d="M 15 22 H 29" stroke={stroke} strokeWidth="1.4" />
          <circle r="2.2" fill={stroke} className="glyph-coin">
            <animateMotion dur="1.6s" repeatCount="indefinite" path="M 15 22 H 29" />
          </circle>
        </>
      )}
      {i === 2 && (
        // Birth: a core sparks new points into being
        <>
          <circle cx="22" cy="22" r="4" fill={stroke} className="glyph-core" />
          {[0, 60, 120, 180, 240, 300].map((deg, k) => (
            <circle
              key={deg}
              cx={22 + 13 * Math.cos((deg * Math.PI) / 180)}
              cy={22 + 13 * Math.sin((deg * Math.PI) / 180)}
              r="1.8"
              fill={stroke}
              className="glyph-spark"
              style={{ animationDelay: `${k * 0.22}s` }}
            />
          ))}
        </>
      )}
      {i === 3 && (
        // Prove: a seal stamps a check, forever
        <>
          <path d="M22 8 L34 15 V29 L22 36 L10 29 V15 Z" stroke={stroke} strokeWidth="1.6" className="glyph-seal" />
          <path d="M16 22.5 L20.5 27 L29 17.5" stroke={stroke} strokeWidth="2" strokeLinecap="round" className="glyph-check" />
        </>
      )}
    </svg>
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

/** A flat-sided hexagon (the proof "seal" shape), centered at cx,cy. */
function hexPath(cx: number, cy: number, w: number, h: number) {
  const q = h * 0.27;
  return `M${cx} ${cy - h / 2} L${cx + w / 2} ${cy - h / 2 + q} L${cx + w / 2} ${cy + h / 2 - q} L${cx} ${cy + h / 2} L${cx - w / 2} ${cy + h / 2 - q} L${cx - w / 2} ${cy - h / 2 + q} Z`;
}

/** Hex digits tumble, then settle left-to-right into the final hash. */
function useScramble(finalHex: string, active: boolean) {
  const [txt, setTxt] = useState(() => finalHex.replace(/[0-9a-f]/gi, "0"));
  useEffect(() => {
    if (!active) return;
    const chars = "0123456789abcdef";
    let frame = 0;
    const total = 26;
    const id = window.setInterval(() => {
      frame += 1;
      const p = frame / total;
      setTxt(
        finalHex
          .split("")
          .map((c, i) => (c === "…" || i / finalHex.length <= p ? c : chars[Math.floor(Math.random() * 16)]))
          .join(""),
      );
      if (frame >= total) window.clearInterval(id);
    }, 45);
    return () => window.clearInterval(id);
  }, [active, finalHex]);
  return txt;
}

/**
 * The closing beat: three hardware-attested deliveries weave up into one
 * proof root — the hash scrambles, then a seal stamps. Mirrors the product's
 * one claim you can't fake: verify the whole job from a single root.
 */
function ProofSection() {
  const reduced = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(svgRef, { once: true, margin: "-90px" });
  const scrambled = useScramble("8f3c1d…a917", inView && !reduced);
  const rootHash = reduced ? "8f3c1d…a917" : scrambled;

  const leaves = [
    { x: 120, cap: "research.market", hash: "0x9f2c" },
    { x: 360, cap: "copywriting.launch", hash: "0x3a7e" },
    { x: 600, cap: "design.keyvisual", hash: "0x71b4" },
  ];
  const threads = [
    "M360 122 C 360 208, 120 188, 120 270",
    "M360 122 L 360 270",
    "M360 122 C 360 208, 600 188, 600 270",
  ];

  return (
    <section className="lp__section lp__proof wrap">
      <motion.div className="eyebrow" variants={fade} initial="hidden" whileInView="show" viewport={{ once: true }}>
        Verify, don't trust
      </motion.div>
      <motion.h2 variants={fade} custom={1} initial="hidden" whileInView="show" viewport={{ once: true }}>
        Every job folds into one hash.
      </motion.h2>

      <svg
        ref={svgRef}
        className="lp__prooftree"
        viewBox="0 0 720 384"
        role="img"
        aria-label="A proof tree: three hardware-attested task deliveries roll up into a single verifiable proof root."
      >
        {threads.map((d, i) => (
          <g key={d}>
            <motion.path
              d={d}
              className="pt-thread"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true, margin: "-90px" }}
              transition={{ delay: 0.35 + i * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
            {!reduced && (
              <circle className="pt-pulse" r="3.2">
                <animateMotion dur="2.8s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path={d} begin={`${1 + i * 0.5}s`} />
              </circle>
            )}
          </g>
        ))}

        {leaves.map((l, i) => (
          <motion.g
            key={l.cap}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-90px" }}
            transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <rect className="pt-leaf" x={l.x - 78} y="270" width="156" height="88" rx="12" />
            <text className="pt-cap" x={l.x} y="302" textAnchor="middle">{l.cap}</text>
            <text className="pt-hash" x={l.x} y="326" textAnchor="middle">
              <tspan className="pt-tick">{"✓"} </tspan>{l.hash}
            </text>
            <text className="pt-attest" x={l.x} y="344" textAnchor="middle">TEE-attested · paid</text>
          </motion.g>
        ))}

        <motion.g
          initial={{ opacity: 0, y: -14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <rect className="pt-root" x="222" y="22" width="276" height="100" rx="16" />
          <text className="pt-root-label" x="252" y="58">PROOF ROOT</text>
          <text className="pt-root-hash" x="252" y="92">0x{rootHash}</text>
          <motion.path
            className="pt-seal"
            d={hexPath(452, 72, 40, 50)}
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.path
            className="pt-check"
            d="M442 72 L449 80 L463 63"
            fill="none"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.15, duration: 0.45, ease: "easeOut" }}
          />
        </motion.g>
      </svg>

      <motion.p className="lp__sub lp__proof-sub" variants={fade} initial="hidden" whileInView="show" viewport={{ once: true }}>
        Each delivery runs under hardware attestation and settles in USDC on Base. They roll up into a single
        proof root — <b className="hl-soft">re-derive it offline</b> and check the whole job yourself.
      </motion.p>
      <motion.div variants={fade} initial="hidden" whileInView="show" viewport={{ once: true }}>
        <Magnetic>
          <Link className="btn btn--primary btn--lg btn--shine mt-3" to="/proof">Open a live proof →</Link>
        </Magnetic>
      </motion.div>
    </section>
  );
}

