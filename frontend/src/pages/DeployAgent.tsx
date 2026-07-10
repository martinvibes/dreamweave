import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";

/**
 * Deploy Agent — answers the "do agents need an API key?" question in the UI:
 * a platform agent just needs a name, skill, price and a prompt (it runs on 0G,
 * no key needed from the creator). Or point us at your own hosted endpoint.
 */
export default function DeployAgent() {
  const nav = useNavigate();
  const { authenticated, login, ready, wallet } = useAuth();
  const [runtime, setRuntime] = useState<"platform" | "endpoint">("platform");
  const [name, setName] = useState("");
  const [capabilityId, setCapabilityId] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("2.00");
  const [tags, setTags] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (ready && !authenticated) {
    return (
      <div className="gate">
        <h2>Connect to deploy an agent</h2>
        <button className="btn btn--primary" onClick={login}>Connect</button>
      </div>
    );
  }

  async function submit() {
    setErr(null);
    if (!name.trim() || !capabilityId.trim()) {
      setErr("Name and skill id are required.");
      return;
    }
    setBusy(true);
    try {
      await api.createAgent({
        name: name.trim(),
        capabilityId: capabilityId.trim(),
        title: title.trim() || name.trim(),
        priceUsdc: price,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        runtime,
        systemPrompt: runtime === "platform" ? systemPrompt : undefined,
        endpointUrl: runtime === "endpoint" ? endpointUrl : undefined,
        payoutAddress: wallet ?? undefined,
      });
      nav("/app/agents");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Deploy agent</div>
          <h1>List a new agent</h1>
          <p>Give it a skill and a price. It becomes hireable across every project and by other agents, and earns USDC per job.</p>
        </div>
      </div>

      <div className="form">
        <div className="field">
          <label>How does it run?</label>
          <div className="seg">
            <button className={runtime === "platform" ? "is-on" : ""} onClick={() => setRuntime("platform")}>Run on 0G (no key needed)</button>
            <button className={runtime === "endpoint" ? "is-on" : ""} onClick={() => setRuntime("endpoint")}>My own endpoint</button>
          </div>
          <span className="hint">
            {runtime === "platform"
              ? "You write a prompt; DreamWeave runs it on 0G with a verifiable proof. No API key required from you."
              : "We POST the task to your URL and use its JSON reply. You host and secure it."}
          </span>
        </div>

        <div className="row">
          <div className="field">
            <label>Name</label>
            <input className="input" placeholder="e.g. Atlas" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Skill id</label>
            <input className="input" placeholder="e.g. research.market" value={capabilityId} onChange={(e) => setCapabilityId(e.target.value)} />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>What it does</label>
            <input className="input" placeholder="e.g. Market research with sources" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Price per task (USDC)</label>
            <input className="input" type="number" min="0" step="0.25" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Tags <span className="hint">(comma separated)</span></label>
          <input className="input" placeholder="research, data, intelligence" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>

        {runtime === "platform" ? (
          <div className="field">
            <label>Instructions (system prompt)</label>
            <textarea className="textarea" placeholder="You are Atlas, a research analyst. Deliver 3-5 findings with sources and one recommendation." value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
          </div>
        ) : (
          <div className="field">
            <label>Endpoint URL</label>
            <input className="input" placeholder="https://my-agent.example.com/run" value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} />
            <span className="hint">Receives {"{ brief, capabilityId }"} and returns {"{ artifact }"}.</span>
          </div>
        )}

        {err && <p style={{ color: "var(--coral)" }} className="mono">{err}</p>}

        <div className="row" style={{ flex: "0 0 auto" }}>
          <button className="btn" onClick={() => nav("/app/agents")} disabled={busy}>Cancel</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy ? "Deploying…" : "Deploy agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
