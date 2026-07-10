import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { _hireWithClient, _provideWithClient } from "../server/src/croo.js";

/**
 * Minimal fake mirroring the AgentClient surface the gateway touches.
 * Emits the REAL wire event names (recorded by scripts/croo-probe.ts):
 * order_negotiation_created, order_created, order_paid, order_completed.
 */
function makeFake() {
  const stream = new EventEmitter() as EventEmitter & { close: () => void };
  stream.close = () => {};
  const calls: string[] = [];
  const client = {
    connectWebSocket: async () => stream,
    negotiateOrder: async (_: unknown) => {
      calls.push("negotiate");
      queueMicrotask(() =>
        stream.emit("order_created", { negotiation_id: "neg-1", order_id: "ord-1" }),
      );
      return { negotiationId: "neg-1" };
    },
    payOrder: async (id: string) => {
      calls.push(`pay:${id}`);
      queueMicrotask(() => stream.emit("order_completed", { order_id: "ord-1" }));
      return { txHash: "0xpaid" };
    },
    getDelivery: async (id: string) => {
      calls.push(`delivery:${id}`);
      return { deliverableText: "the goods" };
    },
    getOrder: async (id: string) => {
      calls.push(`getOrder:${id}`);
      return { requirements: "write docs" };
    },
    acceptNegotiation: async (id: string) => {
      calls.push(`accept:${id}`);
      return { order: { orderId: "ord-9" } };
    },
    deliverOrder: async (id: string, req: { deliverableText: string }) => {
      calls.push(`deliver:${id}:${req.deliverableText}`);
    },
    rejectOrder: async (id: string, reason: string) => {
      calls.push(`reject:${id}:${reason}`);
    },
  };
  return { client, stream, calls };
}

test("hire: negotiate → pay on order_created → getDelivery on order_completed", async () => {
  const { client, calls } = makeFake();
  const result = await _hireWithClient(client as never, {
    serviceId: "svc-1",
    requirements: "do the thing",
    timeoutMs: 2000,
  });
  assert.equal(result.orderId, "ord-1");
  assert.equal(result.deliverableText, "the goods");
  assert.equal(result.payTxHash, "0xpaid");
  assert.deepEqual(calls, ["negotiate", "pay:ord-1", "delivery:ord-1"]);
});

test("provider: accepts negotiation, runs job on order_paid, delivers", async () => {
  const { client, stream, calls } = makeFake();
  await _provideWithClient(client as never, {
    onJob: async (req) => `did: ${req}`,
  });
  stream.emit("order_negotiation_created", { negotiation_id: "neg-9" });
  await new Promise((r) => setTimeout(r, 10));
  stream.emit("order_paid", { order_id: "ord-9" });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(calls.includes("accept:neg-9"), `calls: ${calls.join(",")}`);
  assert.ok(
    calls.some((c) => c.startsWith("deliver:ord-9:did: write docs")),
    `calls: ${calls.join(",")}`,
  );
});

test("hire: schema deliveries fall back to deliverableSchema", async () => {
  const { client } = makeFake();
  (client as { getDelivery: unknown }).getDelivery = async () => ({
    deliverableText: "",
    deliverableSchema: '{"value": 23}',
  });
  const result = await _hireWithClient(client as never, {
    serviceId: "svc-1",
    requirements: "x",
    timeoutMs: 2000,
  });
  assert.equal(result.deliverableText, '{"value": 23}');
});

test("hire: rejects on timeout", async () => {
  const { client } = makeFake();
  (client as { negotiateOrder: unknown }).negotiateOrder = async () => ({
    negotiationId: "neg-x", // no order_created will ever fire
  });
  await assert.rejects(
    _hireWithClient(client as never, {
      serviceId: "svc-1",
      requirements: "x",
      timeoutMs: 50,
    }),
    /timeout/i,
  );
});
