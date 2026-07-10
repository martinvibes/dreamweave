import type { Agent } from "@/lib/api";

export function AgentCard({
  agent,
  action,
}: {
  agent: Agent;
  action?: React.ReactNode;
}) {
  return (
    <article className="card agent rise">
      <div className="agent__top">
        <div className="agent__badge">{agent.name.charAt(0)}</div>
        <div className="agent__rep">
          <b>{agent.reputation}</b>
          <span>rep</span>
        </div>
      </div>
      <div>
        <div className="agent__name">{agent.name}</div>
        <div className="agent__title">{agent.title}</div>
      </div>
      <div className="agent__tags">
        {agent.tags.slice(0, 3).map((t) => (
          <span key={t} className="pill">{t}</span>
        ))}
      </div>
      <div className="agent__foot">
        <span className="agent__price">${agent.priceUsdc} <span>/ task</span></span>
        <span className="agent__runtime">{agent.runtime === "endpoint" ? "external" : "0G"}</span>
      </div>
      {action}
    </article>
  );
}
