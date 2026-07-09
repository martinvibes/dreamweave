/**
 * Event hub — Server-Sent Events, one channel per dream.
 *
 * The orchestrator publishes phase events as a dream is woven; the frontend
 * Loom subscribes and animates them live. Each channel keeps its event log so a
 * client that connects mid-run (or just after casting) replays everything and
 * never misses a phase. No websockets, no deps — plain SSE over HTTP.
 */

import type { ServerResponse } from "node:http";

export interface StreamEvent {
  type: string;
  [k: string]: unknown;
}

interface Channel {
  log: StreamEvent[];
  subscribers: Set<ServerResponse>;
  done: boolean;
}

const channels = new Map<string, Channel>();

function chan(id: string): Channel {
  let c = channels.get(id);
  if (!c) {
    c = { log: [], subscribers: new Set(), done: false };
    channels.set(id, c);
  }
  return c;
}

function write(res: ServerResponse, ev: StreamEvent): void {
  res.write(`data: ${JSON.stringify(ev, bigintReplacer)}\n\n`);
}

function bigintReplacer(_k: string, v: unknown): unknown {
  return typeof v === "bigint" ? v.toString() : v;
}

/** Publish an event to a dream channel (buffers + fans out to live clients). */
export function publish(dreamId: string, ev: StreamEvent): void {
  const c = chan(dreamId);
  c.log.push(ev);
  for (const res of c.subscribers) {
    try {
      write(res, ev);
    } catch {
      c.subscribers.delete(res);
    }
  }
}

/** Mark a channel finished; live clients get a final event and the stream ends. */
export function finish(dreamId: string): void {
  const c = chan(dreamId);
  c.done = true;
  for (const res of c.subscribers) {
    try {
      write(res, { type: "end" });
      res.end();
    } catch {
      /* ignore */
    }
  }
  c.subscribers.clear();
}

/** Attach an SSE subscriber; replays the buffered log immediately. */
export function subscribe(dreamId: string, res: ServerResponse): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "access-control-allow-origin": "*",
    "x-accel-buffering": "no",
  });
  const c = chan(dreamId);
  // Replay history so late subscribers are fully caught up.
  for (const ev of c.log) write(res, ev);
  if (c.done) {
    write(res, { type: "end" });
    res.end();
    return;
  }
  c.subscribers.add(res);
  // Heartbeat to keep proxies from closing the connection.
  const hb = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      clearInterval(hb);
    }
  }, 15000);
  res.on("close", () => {
    clearInterval(hb);
    c.subscribers.delete(res);
  });
}

/** Drop a channel's buffer once a dream is fully done and persisted. */
export function clearChannel(dreamId: string): void {
  channels.delete(dreamId);
}
