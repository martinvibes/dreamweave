import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

const HUB = { x: 980, y: 255 } as const;

/**
 * The hero loom, disciplined: five nested threads sweep in from the left and
 * converge in the right gutter — outside the text column — meeting at a small
 * bright hub and continuing as one strand. No crossings, no stray marks.
 */
export function ThreadField() {
  const reduced = useReducedMotion();

  const threads = useMemo(() => {
    const n = 5;
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1); // 0..1
      const y0 = 120 + t * 270; // 120..390, even
      const center = 1 - Math.abs(t - 0.5) * 2; // peaks middle
      return { y0, delay: 0.1 + i * 0.16, opacity: 0.16 + center * 0.26, width: 1.1 + center * 0.8 };
    });
  }, []);

  return (
    <svg
      className="threadfield"
      viewBox="0 0 1200 500"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="tf-thread" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--amber)" stopOpacity="0" />
          <stop offset="55%" stopColor="var(--amber)" />
          <stop offset="100%" stopColor="var(--amber-hi)" />
        </linearGradient>
        <radialGradient id="tf-hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--amber-hi)" stopOpacity="0.9" />
          <stop offset="45%" stopColor="var(--amber)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--amber)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* nested fan — one curve family, zero crossings */}
      {threads.map((t, i) => (
        <motion.path
          key={i}
          d={`M -40 ${t.y0} C 420 ${t.y0}, 700 ${HUB.y + (t.y0 - HUB.y) * 0.28}, ${HUB.x} ${HUB.y}`}
          stroke="url(#tf-thread)"
          strokeWidth={t.width}
          strokeLinecap="round"
          fill="none"
          opacity={t.opacity}
          initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1], delay: t.delay }}
        />
      ))}

      {/* one strand continues out — calm, single */}
      <motion.path
        d={`M ${HUB.x} ${HUB.y} C 1060 ${HUB.y}, 1120 ${HUB.y - 10}, 1250 ${HUB.y - 6}`}
        stroke="var(--amber)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 1.7 }}
      />

      {/* small, tight hub */}
      <motion.circle
        cx={HUB.x}
        cy={HUB.y}
        r="26"
        fill="url(#tf-hub)"
        initial={{ opacity: 0 }}
        animate={reduced ? { opacity: 0.8 } : { opacity: [0.55, 0.85, 0.55] }}
        transition={reduced ? { duration: 0.5 } : { duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      <motion.circle
        cx={HUB.x}
        cy={HUB.y}
        r="4"
        fill="var(--amber-hi)"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }}
      />
    </svg>
  );
}
