import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";
interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}
const Ctx = createContext<ThemeCtx | null>(null);

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme within ThemeProvider");
  return v;
}

function initial(): Theme {
  const saved = localStorage.getItem("dw-theme");
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("dw-theme", theme);
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>
      {children}
    </Ctx.Provider>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme" title="Toggle light / dark">
      <span className={`theme-toggle__knob theme-toggle__knob--${theme}`}>
        {theme === "dark" ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="10" cy="10" r="3.4" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return <line key={a} x1={10 + Math.cos(r) * 6} y1={10 + Math.sin(r) * 6} x2={10 + Math.cos(r) * 7.8} y2={10 + Math.sin(r) * 7.8} strokeLinecap="round" />;
      })}
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M16 11.5A6 6 0 018.5 4a6 6 0 106.5 8z" strokeLinejoin="round" />
    </svg>
  );
}
