export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden
      style={{ color: "var(--amber)", filter: "drop-shadow(0 0 8px var(--amber-glow))" }}>
      <circle cx="7" cy="16" r="3.2" fill="currentColor" />
      {[7, 16, 25].map((y) => (
        <path key={y} d={`M 10 16 C 18 16, 18 ${y}, 25 ${y}`} stroke="currentColor" strokeWidth="1.6" fill="none" opacity={0.9} />
      ))}
      {[7, 16, 25].map((y) => (
        <circle key={y} cx="25" cy={y} r="2.5" fill="currentColor" opacity={0.85} />
      ))}
    </svg>
  );
}
