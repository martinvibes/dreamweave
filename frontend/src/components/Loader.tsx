import { motion } from "framer-motion";

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
