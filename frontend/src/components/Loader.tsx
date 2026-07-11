import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * The signature wait state: a miniature loom. Threads draw themselves into
 * the hub on a loop; pass `lines` to cycle status messages beneath it.
 */
export function Weaving({ label, lines, size = 120 }: { label?: string; lines?: string[]; size?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!lines || lines.length < 2) return;
    const t = setInterval(() => setI((x) => x + 1), 1700);
    return () => clearInterval(t);
  }, [lines]);
  const text = lines ? lines[i % lines.length] : label;

  return (
    <div className="weaving" role="status" aria-label={text ?? "loading"}>
      <svg viewBox="0 0 120 40" width={size} height={size / 3} aria-hidden>
        {[8, 20, 32].map((y, k) => (
          <path
            key={y}
            className="weaving__t"
            style={{ animationDelay: `${k * 0.28}s` }}
            pathLength={1}
            d={`M 4 ${y} C 44 ${y}, 62 ${20 + (y - 20) * 0.25}, 92 20`}
          />
        ))}
        <circle className="weaving__hub" cx="92" cy="20" r="3.6" />
        <path className="weaving__out" pathLength={1} d="M 92 20 C 102 20, 108 19, 118 19.5" />
      </svg>
      {text && (
        <AnimatePresence mode="wait">
          <motion.span
            key={text}
            className="loader__label"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3 }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      )}
    </div>
  );
}

/** Full-panel weaving state. */
export function WeavingPanel({ lines, label }: { lines?: string[]; label?: string }) {
  return (
    <motion.div
      className="empty"
      style={{ minHeight: 240, display: "grid", placeItems: "center" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Weaving lines={lines} label={label} size={150} />
    </motion.div>
  );
}

/** Shimmering list-row skeletons (for ledgers and run lists). */
export function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <div className="list">
      {Array.from({ length: n }).map((_, i) => (
        <motion.div
          key={i}
          className="list__row"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.07 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            <Skeleton h={15} w={`${52 - i * 6}%`} />
            <Skeleton h={11} w="30%" />
          </div>
          <Skeleton h={20} w={64} r={999} />
          <Skeleton h={14} w={54} />
        </motion.div>
      ))}
    </div>
  );
}

/** Shimmering stat-tile skeletons. */
export function SkeletonTiles({ n = 4 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <motion.div
          key={i}
          className="card tile"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
        >
          <Skeleton h={34} w={64} />
          <div style={{ marginTop: 8 }}>
            <Skeleton h={10} w="70%" />
          </div>
        </motion.div>
      ))}
    </>
  );
}

/** Branded spinner with an optional label — used for any async wait. */
export function Loader({ label }: { label?: string }) {
  return (
    <div className="loader">
      <svg className="loader__ring" viewBox="0 0 50 50">
        <circle className="bg" cx="25" cy="25" r="20" />
        <circle className="fg" cx="25" cy="25" r="20" />
      </svg>
      {label && <span className="loader__label">{label}</span>}
    </div>
  );
}

/** Full-panel centered loader. */
export function LoadingPanel({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="empty" style={{ minHeight: 260 }}>
      <Loader label={label} />
    </div>
  );
}

/** A shimmering skeleton block. */
export function Skeleton({ h = 16, w = "100%", r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="sk" style={{ height: h, width: w, borderRadius: r }} />;
}

/** Card-shaped skeletons for grids. */
export function SkeletonCards({ n = 6 }: { n?: number }) {
  return (
    <div className="grid grid--3">
      {Array.from({ length: n }).map((_, i) => (
        <motion.div
          key={i}
          className="card"
          style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, minHeight: 168 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Skeleton h={40} w={40} r={10} />
            <Skeleton h={30} w={30} r={8} />
          </div>
          <Skeleton h={18} w="60%" />
          <Skeleton h={13} w="85%" />
          <div style={{ marginTop: "auto", display: "flex", gap: 6 }}>
            <Skeleton h={20} w={54} r={999} />
            <Skeleton h={20} w={54} r={999} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
