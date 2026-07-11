/**
 * CROO gateway — our one integration point with the real store.
 *
 * Requester leg:  hireService()  — negotiate, pay, await delivery.
 * Provider leg:   startProvider() — accept negotiations, deliver on payment.
 *
 * The SDK's WS stream emits snake_case wire events (recorded live by
 * scripts/croo-probe.ts): order_negotiation_created, order_created,
 * order_paid, order_completed, order_rejected, order_expired. One stream
 * carries all of an agent's orders, so ids are correlated manually.
 */

import { AgentClient, DeliverableType } from "@croo-network/sdk";
import { config } from "./config.js";

export interface HireResult {
  orderId: string;
  serviceId: string;
  deliverableText: string;
  payTxHash?: string;
}

export function makeClient(sdkKey: string): AgentClient {
  return new AgentClient(
    { baseURL: config.croo.apiUrl, wsURL: config.croo.wsUrl },
    sdkKey,
  );
}

/**
 * CROO allows ONE websocket per SDK key — a second connection is killed as a
 * "duplicate key" policy violation. Every consumer (provider loop + hires)
 * must share a single client + stream per key.
 */
const pool = new Map<string, { client: AgentClient; stream: Promise<StreamLike> }>();

function connection(sdkKey: string): { client: AgentClient; stream: Promise<StreamLike> } {
  let c = pool.get(sdkKey);
  if (!c) {
    const client = makeClient(sdkKey);
    c = { client, stream: client.connectWebSocket() as unknown as Promise<StreamLike> };
    pool.set(sdkKey, c);
  }
  return c;
}

interface WsEvent {
  negotiation_id?: string;
  order_id?: string;
  requirements?: string;
}

interface StreamLike {
  on(event: string, cb: (e: WsEvent) => void): void;
  close(): void;
}

/** Internal, client-injected implementation — exported for tests. */
export async function _hireWithClient(
  client: AgentClient,
  opts: { serviceId: string; requirements: string; timeoutMs?: number },
  sharedStream?: StreamLike,
): Promise<HireResult> {
  const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;
  const stream =
    sharedStream ?? ((await client.connectWebSocket()) as unknown as StreamLike);

  // The stream is shared and the SDK has no off(): guard every handler so a
  // settled hire ignores later events instead of double-resolving.
  let settled = false;

  return await new Promise<HireResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`hire timeout after ${timeoutMs}ms (service ${opts.serviceId})`));
      }, timeoutMs);
      const fail = (err: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      let negotiationId = "";
      let orderId = "";
      let payTxHash: string | undefined;

      // order_created can beat negotiateOrder()'s response — buffer until
      // we know our negotiation id, then replay.
      const earlyCreated: WsEvent[] = [];
      const onCreated = async (e: WsEvent) => {
        if (settled || !e.order_id) return;
        if (!negotiationId) {
          earlyCreated.push(e);
          return;
        }
        if (e.negotiation_id !== negotiationId || orderId) return;
        orderId = e.order_id;
        try {
          const paid = await client.payOrder(orderId);
          payTxHash = (paid as { txHash?: string }).txHash;
        } catch (err) {
          fail(err);
        }
      };
      stream.on("order_created", onCreated);

      stream.on("order_completed", async (e) => {
        if (settled || e.order_id !== orderId || !orderId) return;
        try {
          const d = (await client.getDelivery(orderId)) as {
            deliverableText?: string;
            deliverableSchema?: string;
          };
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({
            orderId,
            serviceId: opts.serviceId,
            // "text" deliveries use deliverableText; "schema" deliveries
            // carry their JSON payload in deliverableSchema.
            deliverableText: String(d.deliverableText || d.deliverableSchema || ""),
            payTxHash,
          });
        } catch (err) {
          fail(err);
        }
      });

      stream.on("order_rejected", (e) => {
        if (e.order_id === orderId && orderId) fail(new Error(`order ${orderId} rejected`));
      });
      stream.on("order_expired", (e) => {
        if (e.order_id === orderId && orderId)
          fail(new Error(`order ${orderId} expired (SLA breach)`));
      });

      client
        .negotiateOrder({ serviceId: opts.serviceId, requirements: opts.requirements })
        .then((n) => {
          negotiationId = (n as { negotiationId?: string }).negotiationId ?? "";
          if (!negotiationId) {
            fail(new Error("negotiateOrder returned no negotiationId"));
            return;
          }
          for (const e of earlyCreated.splice(0)) void onCreated(e);
        })
        .catch(fail);
    });
}

/** Internal, client-injected provider loop — exported for tests. */
export async function _provideWithClient(
  client: AgentClient,
  opts: {
    onJob: (requirements: string, orderId: string) => Promise<string>;
    /** our agent id — on a shared stream, ignore orders we are BUYING */
    agentId?: string;
  },
  sharedStream?: StreamLike,
): Promise<() => void> {
  const stream =
    sharedStream ?? ((await client.connectWebSocket()) as unknown as StreamLike);

  stream.on("order_negotiation_created", async (e) => {
    if (!e.negotiation_id) return;
    try {
      await client.acceptNegotiation(e.negotiation_id);
    } catch (err) {
      console.error("acceptNegotiation failed:", err);
    }
  });

  stream.on("order_paid", async (e) => {
    if (!e.order_id) return;
    try {
      const order = (await client.getOrder(e.order_id)) as {
        requirements?: string;
        providerAgentId?: string;
      };
      // Shared stream carries our BUYER-side events too — only act as the
      // provider on orders that are actually ours to deliver.
      if (opts.agentId && order.providerAgentId && order.providerAgentId !== opts.agentId) {
        return;
      }
      const requirements = String(order.requirements ?? e.requirements ?? "");
      const text = await opts.onJob(requirements, e.order_id);
      await client.deliverOrder(e.order_id, {
        deliverableType: DeliverableType.Text,
        deliverableText: text,
      });
    } catch (err) {
      console.error(`job for order ${e.order_id} failed:`, err);
      try {
        await client.rejectOrder(e.order_id, "internal error while fulfilling order");
      } catch {
        /* already logged */
      }
    }
  });

  return () => stream.close();
}

/** CROO's API requires `requirements` to be valid JSON — wrap plain text. */
function asJsonRequirements(requirements: string): string {
  try {
    JSON.parse(requirements);
    return requirements;
  } catch {
    return JSON.stringify({ task: requirements });
  }
}

/** Public API — real clients from config/env keys. */
export async function hireService(opts: {
  serviceId: string;
  requirements: string;
  timeoutMs?: number;
  sdkKey?: string;
}): Promise<HireResult> {
  const conn = connection(opts.sdkKey ?? config.croo.sdkKey);
  return _hireWithClient(
    conn.client,
    { ...opts, requirements: asJsonRequirements(opts.requirements) },
    await conn.stream,
  );
}

export async function startProvider(opts: {
  sdkKey: string;
  agentId?: string;
  onJob: (requirements: string, orderId: string) => Promise<string>;
}): Promise<() => void> {
  const conn = connection(opts.sdkKey);
  await _provideWithClient(
    conn.client,
    { onJob: opts.onJob, agentId: opts.agentId },
    await conn.stream,
  );
  return () => {}; // shared stream stays open for other consumers
}
