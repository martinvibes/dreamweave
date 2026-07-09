/**
 * Probe the 0G Private Computer API: confirm the base URL, list models, and run
 * one tiny completion so we know the exact model ids + that the key works.
 *
 *   node scripts/probe-0g.mjs
 *
 * Reads LLM_BASE_URL / LLM_API_KEY / LLM_MODEL from the environment (.env).
 * Tries a few candidate base URLs if the configured one 404s.
 */

const KEY = process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL || "deepseek-v4-flash";
const CANDIDATES = [
  process.env.LLM_BASE_URL,
  "https://router-api.0g.ai/v1",
  "https://api.0g.ai/v1",
  "https://inference.0g.ai/v1",
].filter(Boolean);

if (!KEY) {
  console.error("LLM_API_KEY not set. Run with your .env loaded.");
  process.exit(1);
}

async function tryBase(base) {
  const headers = { authorization: `Bearer ${KEY}` };
  try {
    const r = await fetch(`${base}/models`, { headers });
    if (!r.ok) return { base, ok: false, status: r.status };
    const data = await r.json();
    const ids = (data.data || data.models || [])
      .map((m) => m.id || m.name)
      .filter(Boolean);
    return { base, ok: true, ids };
  } catch (e) {
    return { base, ok: false, error: String(e) };
  }
}

let working = null;
for (const base of CANDIDATES) {
  const res = await tryBase(base);
  console.log(
    `GET ${base}/models → ${res.ok ? "OK" : "FAIL"} ${
      res.ids ? `(${res.ids.length} models)` : res.status || res.error || ""
    }`,
  );
  if (res.ok) {
    working = base;
    console.log("  models:", res.ids.slice(0, 40).join(", "));
    break;
  }
}

if (!working) {
  console.error("\nNo candidate base URL responded. Check the 0G docs for the exact endpoint.");
  process.exit(2);
}

console.log(`\nRunning a test completion on ${working} with model=${MODEL} …`);
const r = await fetch(`${working}/chat/completions`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: "user", content: "Reply with exactly: DREAMWEAVE-OK" }],
    max_tokens: 20,
  }),
});
console.log("status:", r.status);
const teeHeaders = [...r.headers.entries()].filter(([k]) =>
  /tee|proof|0g|attest/i.test(k),
);
if (teeHeaders.length) console.log("TEE headers:", teeHeaders);
const body = await r.text();
console.log("body:", body.slice(0, 800));
