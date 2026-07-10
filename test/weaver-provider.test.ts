import { test } from "node:test";
import assert from "node:assert/strict";
import { _fulfilOutcomeWith } from "../server/src/weaverProvider.js";

test("fulfil composes dream result + proof tree into delivery JSON", async () => {
  const text = await _fulfilOutcomeWith(
    {
      runDream: async (goal) => ({
        artifacts: [{ agent: "Sage", text: `research for: ${goal}` }],
        prooftree: {
          root: "0xroot",
          leaves: [
            {
              orderId: "ord-1",
              serviceId: "svc-1",
              agent: "Sage",
              role: "hired" as const,
              deliverableHash: "0xaaa",
            },
          ],
        },
      }),
    },
    "launch plan for my coffee brand",
    "ord-buyer-1",
  );
  const parsed = JSON.parse(text) as {
    result: { agent: string; text: string }[];
    prooftree: { root: string; leaves: unknown[] };
    orderId: string;
  };
  assert.equal(parsed.prooftree.root, "0xroot");
  assert.equal(parsed.result[0]!.agent, "Sage");
  assert.equal(parsed.result[0]!.text, "research for: launch plan for my coffee brand");
  assert.equal(parsed.orderId, "ord-buyer-1");
});
