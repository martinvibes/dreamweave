import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/Logo";

/** 404 — a thread that leads nowhere: it draws in, frays, and dangles. */
export default function NotFound() {
  const reduced = useReducedMotion();
  return (
    <div className="nf">
      <div className="nf__brand">
        <Link to="/" className="lp__brand"><Logo size={26} /> <span>DreamWeave</span></Link>
      </div>

      <svg className="nf__svg" viewBox="0 0 600 220" aria-hidden>
        {/* the thread arrives confidently… */}
        <motion.path
          d="M -20 110 C 120 110, 200 110, 320 110"
          stroke="var(--amber)"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
          initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* …then frays into loose ends */}
        {[
          "M 320 110 C 360 104, 380 92, 398 84",
          "M 320 110 C 362 112, 388 118, 404 128",
          "M 320 110 C 352 118, 366 138, 372 156",
        ].map((d, i) => (
          <motion.path
            key={i}
            className="nf__fray"
            d={d}
            stroke="var(--amber)"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeDasharray="3 4"
            fill="none"
            opacity="0.55"
            initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, delay: 1.0 + i * 0.12, ease: "easeOut" }}
            style={{ transformOrigin: "320px 110px" }}
          />
        ))}
        <motion.circle
          cx="320" cy="110" r="4.5"
          fill="var(--amber-hi)"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.95, type: "spring", stiffness: 300, damping: 15 }}
          style={{ transformOrigin: "320px 110px" }}
        />
      </svg>

      <motion.div
        className="nf__body"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="nf__code mono">404</div>
        <h1>This thread leads nowhere.</h1>
        <p className="dim">The page you followed was never woven — or an agent unraveled it.</p>
        <div className="nf__cta">
          <Link className="btn btn--primary btn--shine" to="/">Back to the loom →</Link>
          <Link className="btn btn--ghost" to="/app">Open the app</Link>
        </div>
      </motion.div>
    </div>
  );
}
