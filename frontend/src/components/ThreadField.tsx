import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * The woven hero field: loose threads draw themselves in from the left,
 * converge through a glowing hub (the Weaver), and emerge as one braid.
 * One thread arrives late and brighter — the newborn. Decorative only.
 */
export function ThreadField() {
  const reduced = useReducedMotion();

  // Hand-tuned loom: [startY, sag, endY, delay, opacity]
  const threads = useMemo(
    () =>
      [
        [60, -30, 236, 0.0, 0.30],
        [130, 20, 244, 0.25, 0.38],
        [210, -14, 250, 0.5, 0.46],
        [300, 26, 256, 0.75, 0.38],
        [380, -20, 262, 1.0, 0.30],
        [440, 30, 268, 1.25, 0.24],
      ] as const,
    [],
  );

  return (
    <svg
      className="threadfield"
      viewBox="0 0 1200 500"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="tf-thread" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--amber-lo)" stopOpacity="0" />
          <stop offset="35%" stopColor="var(--amber)" />
          <stop offset="100%" stopColor="var(--amber-hi)" />
        </linearGradient>
        <radialGradient id="tf-hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--amber-hi)" />
          <stop offset="60%" stopColor="var(--amber)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--amber)" stopOpacity="0" />
        </radialGradient>
        <filter id="tf-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* incoming threads → hub at (760, 250) */}
      {threads.map(([y0, sag, yHub, delay, op], i) => (
        <motion.path
          key={i}
          d={`M -40 ${y0} C 280 ${y0 + sag}, 520 ${yHub + (y0 - yHub) * 0.25}, 760 ${yHub}`}
          stroke="url(#tf-thread)"
          strokeWidth={i === 2 ? 2 : 1.4}
          fill="none"
          opacity={op}
          initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1], delay }}
        />
      ))}

      {/* the braid: one woven strand out of the hub */}
      <motion.path
        d="M 760 250 C 880 250, 900 238, 980 238 S 1130 262, 1240 250"
        stroke="var(--amber)"
        strokeWidth="2.6"
        fill="none"
        opacity="0.85"
        filter="url(#tf-glow)"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 1.7 }}
      />
      <motion.path
        d="M 760 250 C 880 250, 900 262, 980 262 S 1130 238, 1240 250"
        stroke="var(--amber-hi)"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 1.85 }}
      />

      {/* the newborn: arrives late, brighter, from below */}
      <motion.path
        d="M 300 560 C 460 480, 600 330, 760 250"
        stroke="var(--mint)"
        strokeWidth="1.8"
        fill="none"
        opacity="0.6"
        filter="url(#tf-glow)"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 2.6 }}
      />

      {/* hub */}
      <motion.circle
        cx="760"
        cy="250"
        r="46"
        fill="url(#tf-hub)"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={
          reduced
            ? { opacity: 0.7, scale: 1 }
            : { opacity: [0.55, 0.85, 0.55], scale: [1, 1.06, 1] }
        }
        transition={
          reduced
            ? { duration: 0.5 }
            : { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 1.4 }
        }
        style={{ transformOrigin: "760px 250px" }}
      />
      <motion.circle
        cx="760"
        cy="250"
        r="7"
        fill="var(--amber-hi)"
        filter="url(#tf-glow)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
      />
    </svg>
  );
}
