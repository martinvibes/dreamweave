import { test } from "node:test";
import assert from "node:assert/strict";
import { _runStoreSubtask } from "../server/src/orchestrator.js";

test("store subtask hires via gateway and returns a proof leaf", async () => {
  const events: string[] = [];
  const leaf = await _runStoreSubtask(
    {
      hire: async ({ serviceId, requirements }) => ({
        orderId: "ord-7",
        serviceId,
        deliverableText: JSON.stringify({ result: `done: ${requirements}` }),
        payTxHash: "0xabc",
      }),
      emit: (phase) => events.push(phase),
    },
    {
      serviceId: "svc-research",
      name: "ProofDesk",
      requirements: "research the coffee market",
    },
  );
  assert.equal(leaf.role, "hired");
  assert.equal(leaf.orderId, "ord-7");
  assert.equal(leaf.payTxHash, "0xabc");
  assert.match(leaf.deliverableHash, /^0x/);
  assert.deepEqual(events, ["negotiate", "lock", "deliver", "clear"]);
});
