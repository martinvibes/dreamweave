import { test } from "node:test";
import assert from "node:assert/strict";
import { _birthWith } from "../server/src/foundry.js";
import { listAgents } from "../server/src/repo.js";

test("birth animates a vessel: DB row + provider loop + identity from LLM", async () => {
  const started: string[] = [];
  const result = await _birthWith(
    {
      vessels: [{ sdkKey: "croo_sk_v1", agentId: "vessel-1", serviceId: "svc-v1" }],
      generateIdentity: async (capabilityId) => ({
        name: "Nova",
        systemPrompt: `You are a specialist in ${capabilityId}.`,
      }),
      startProvider: async ({ sdkKey }) => {
        started.push(sdkKey);
        return () => {};
      },
    },
    { capabilityId: "translate.swahili", brief: "translate launch copy to Swahili" },
  );

  assert.equal(result.agent.name, "Nova");
  assert.equal(result.agent.parentId, "foundry");
  assert.equal(result.serviceId, "svc-v1");
  assert.deepEqual(started, ["croo_sk_v1"]);

  const roster = await listAgents("translate.swahili");
  assert.ok(roster.some((a) => a.name === "Nova"));
});

test("birth with no free vessel falls back to local child", async () => {
  const result = await _birthWith(
    {
      vessels: [],
      generateIdentity: async () => ({ name: "Echo", systemPrompt: "x" }),
      startProvider: async () => () => {},
    },
    { capabilityId: "audit.contracts", brief: "audit this" },
  );
  assert.equal(result.serviceId, "local");
  assert.equal(result.agent.name, "Echo");
});

test("a vessel already claimed in the DB is not reused", async () => {
  // svc-v1 was claimed by Nova in the first test.
  const result = await _birthWith(
    {
      vessels: [{ sdkKey: "croo_sk_v1", agentId: "vessel-1", serviceId: "svc-v1" }],
      generateIdentity: async () => ({ name: "Kite", systemPrompt: "x" }),
      startProvider: async () => () => {},
    },
    { capabilityId: "compose.music", brief: "make a jingle" },
  );
  assert.equal(result.serviceId, "local");
});
