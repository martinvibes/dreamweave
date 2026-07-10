import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/theme/ThemeProvider";
import { Logo } from "./Logo";

const NAV = [
  { to: "/app", label: "Overview", end: true, icon: iconGrid },
  { to: "/app/projects", label: "Runs", icon: iconStack },
  { to: "/app/agents", label: "Roster", icon: iconUsers },
  { to: "/app/payments", label: "Earnings", icon: iconCoin },
];

export function AppShell() {
  const navigate = useNavigate();

  return (
    <div className="shell">
      <aside className="side">
        <div className="side__brand" onClick={() => navigate("/")}>
          <Logo size={26} />
          <span>DreamWeave</span>
        </div>

        <button className="btn btn--primary side__cta" onClick={() => navigate("/app/new")}>
          ▶ Run a goal
        </button>

        <nav className="side__nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `side__link${isActive ? " is-active" : ""}`}
            >
              <span className="side__ico">{n.icon()}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="side__foot">
          <a className="side__mini" href="https://github.com/martinvibes/dreamweave" target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
          <a className="side__mini" href="/proof" target="_blank" rel="noreferrer">
            Public proof ↗
          </a>
          <a className="side__mini" href="/.well-known/dreamweave.json" target="_blank" rel="noreferrer">
            Agent API ↗
          </a>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__status">
            <a
              className="pill"
              href="https://agent.croo.network/agents/58729a60-4a85-44c3-b7f0-654f3c1ee5db"
              target="_blank"
              rel="noreferrer"
              title="Our live listing on the CROO Agent Store"
            >
              <span className="dot" style={{ background: "var(--amber)" }} /> Live on CROO Store ↗
            </a>
            <span className="pill"><span className="dot" style={{ background: "var(--violet)" }} /> AI on 0G</span>
            <span className="pill"><span className="dot" style={{ background: "var(--sky)" }} /> Paid on Base · USDC</span>
          </div>
          <div className="topbar__acct">
            <a className="btn btn--sm btn--ghost" href="/proof" target="_blank" rel="noreferrer">
              Public proof ↗
            </a>
            <ThemeToggle />
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// --- inline icons (stroke = currentColor) ---
function iconGrid() {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" />
    </svg>
  );
}
function iconStack() {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 3l7 3.5-7 3.5-7-3.5L10 3z" /><path d="M3 10.5l7 3.5 7-3.5" /><path d="M3 14l7 3.5 7-3.5" />
    </svg>
  );
}
function iconUsers() {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="7.5" cy="7" r="2.6" /><path d="M3 16c0-2.5 2-4 4.5-4S12 13.5 12 16" /><path d="M13 7.2a2.4 2.4 0 010 4.6M14 16c0-2 -1-3.3-2.4-3.8" />
    </svg>
  );
}
function iconCoin() {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="7" /><path d="M10 6.5v7M8 8.5h3a1.5 1.5 0 010 3H8.5" />
    </svg>
  );
}
