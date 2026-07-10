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
): Promise<HireResult> {
  const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;
  const stream = (await client.connectWebSocket()) as unknown as StreamLike;

  try {
    return await new Promise<HireResult>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(`hire timeout after ${timeoutMs}ms (service ${opts.serviceId})`),
          ),
        timeoutMs,
      );
      const fail = (err: unknown) => {
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
        if (!e.order_id) return;
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
        if (e.order_id !== orderId || !orderId) return;
        try {
          const d = await client.getDelivery(orderId);
          clearTimeout(timer);
          resolve({
            orderId,
            serviceId: opts.serviceId,
            deliverableText: String(
              (d as { deliverableText?: string }).deliverableText ?? "",
            ),
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
  } finally {
    stream.close();
  }
}

/** Internal, client-injected provider loop — exported for tests. */
export async function _provideWithClient(
  client: AgentClient,
  opts: { onJob: (requirements: string, orderId: string) => Promise<string> },
): Promise<() => void> {
  const stream = (await client.connectWebSocket()) as unknown as StreamLike;

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
      // Requirements may ride on the event; if absent, fetch the order.
      let requirements = e.requirements ?? "";
      if (!requirements) {
        const order = await client.getOrder(e.order_id);
        requirements = String((order as { requirements?: string }).requirements ?? "");
      }
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

/** Public API — real clients from config/env keys. */
export async function hireService(opts: {
  serviceId: string;
  requirements: string;
  timeoutMs?: number;
  sdkKey?: string;
}): Promise<HireResult> {
  return _hireWithClient(makeClient(opts.sdkKey ?? config.croo.sdkKey), opts);
}

export async function startProvider(opts: {
  sdkKey: string;
  onJob: (requirements: string, orderId: string) => Promise<string>;
}): Promise<() => void> {
  return _provideWithClient(makeClient(opts.sdkKey), { onJob: opts.onJob });
}
