import { type RefObject } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";

/**
 * The spine: one continuous thread that weaves down the whole landing page,
 * drawing itself as you scroll — the page IS the loom. Sits behind content;
 * vector-effect keeps the stroke crisp despite non-uniform scaling.
 */
export function WeaveSpine({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef as RefObject<HTMLElement>,
    offset: ["start start", "end 0.9"],
    layoutEffect: false, // ref lives in the parent; avoids hydration warning
  });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 });

  // 0..100 wide, 0..1000 tall — starts BELOW the hero so it stays pristine,
  // then weaves left → right → center to the footer.
  const d =
    "M 50 150 " +
    "C 50 195, 22 215, 22 262 " +
    "S 78 340, 78 392 " +
    "S 20 465, 20 520 " +
    "S 80 592, 80 648 " +
    "S 25 715, 25 770 " +
    "S 75 838, 75 888 " +
    "S 50 945, 50 968 " +
    "L 50 986";

  return (
    <svg className="wspine" viewBox="0 0 100 1000" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="ws-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--amber)" />
          <stop offset="55%" stopColor="var(--amber-hi)" />
          <stop offset="85%" stopColor="var(--mint)" />
          <stop offset="100%" stopColor="var(--amber)" />
        </linearGradient>
      </defs>
      {/* ghost of the full path — where the thread will go */}
      <path className="wspine__ghost" d={d} />
      {/* the drawn thread, linked to scroll — round cap reads as the tip */}
      <motion.path
        className="wspine__thread"
        d={d}
        style={reduced ? { pathLength: 1 } : { pathLength: progress }}
      />
    </svg>
  );
}
