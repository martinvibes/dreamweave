import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

const HUB = { x: 880, y: 318 } as const;

/**
 * The woven hero field: an even fan of threads sweeps in from the left and
 * converges through a glowing hub (the Weaver), emerging as one braid — the
 * logo, come to life. One late thread rises from below: the newborn.
 */
export function ThreadField() {
  const reduced = useReducedMotion();

  // An even fan: same curve family, uniform spacing, opacity peaks center.
  const threads = useMemo(() => {
    const n = 6;
    return Array.from({ length: n }, (_, i) => {
      const y0 = 140 + i * (300 / (n - 1)); // 140..440, even
      const center = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2); // 0..1..0
      return {
        y0,
        delay: i * 0.14,
        opacity: 0.22 + center * 0.3,
        width: 1.2 + center * 0.9,
      };
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
          <stop offset="0%" stopColor="var(--amber-lo)" stopOpacity="0" />
          <stop offset="45%" stopColor="var(--amber)" />
          <stop offset="100%" stopColor="var(--amber-hi)" />
        </linearGradient>
        <radialGradient id="tf-hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--amber-hi)" />
          <stop offset="60%" stopColor="var(--amber)" stopOpacity="0.5" />
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

      {/* the fan: every thread shares one curve family → calm, intentional */}
      {threads.map((t, i) => (
        <motion.path
          key={i}
          d={`M -40 ${t.y0} C 340 ${t.y0}, 640 ${HUB.y + (t.y0 - HUB.y) * 0.32}, ${HUB.x} ${HUB.y}`}
          stroke="url(#tf-thread)"
          strokeWidth={t.width}
          strokeLinecap="round"
          fill="none"
          opacity={t.opacity}
          initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.9, ease: [0.16, 1, 0.3, 1], delay: t.delay }}
        />
      ))}

      {/* the braid: two strands out of the hub, gently interleaving */}
      <motion.path
        d={`M ${HUB.x} ${HUB.y} C 980 318, 1000 306, 1070 306 S 1180 330, 1260 318`}
        stroke="var(--amber)"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
        filter="url(#tf-glow)"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 1.6 }}
      />
      <motion.path
        d={`M ${HUB.x} ${HUB.y} C 980 318, 1000 330, 1070 330 S 1180 306, 1260 318`}
        stroke="var(--amber-hi)"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 1.75 }}
      />

      {/* the newborn: same curve family, from below, mint, late */}
      <motion.path
        d={`M 460 580 C 640 500, 740 ${HUB.y + 90}, ${HUB.x} ${HUB.y}`}
        stroke="var(--mint)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
        filter="url(#tf-glow)"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay: 2.5 }}
      />

      {/* hub */}
      <motion.circle
        cx={HUB.x}
        cy={HUB.y}
        r="46"
        fill="url(#tf-hub)"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={
          reduced
            ? { opacity: 0.7, scale: 1 }
            : { opacity: [0.5, 0.8, 0.5], scale: [1, 1.05, 1] }
        }
        transition={
          reduced
            ? { duration: 0.5 }
            : { duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 1.3 }
        }
        style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }}
      />
      <motion.circle
        cx={HUB.x}
        cy={HUB.y}
        r="6.5"
        fill="var(--amber-hi)"
        filter="url(#tf-glow)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3, duration: 0.6 }}
      />
    </svg>
  );
}
