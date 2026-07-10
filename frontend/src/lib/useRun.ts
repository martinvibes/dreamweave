import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Task } from "@/lib/api";

export type RunPhase =
  | "planned"
  | "match"
  | "negotiate"
  | "lock"
  | "deliver"
  | "clear"
  | "void";

export interface RunTask {
  id: string;
  idx: number;
  sellerName: string;
  capabilityId: string;
  priceUsdc: string;
  phase: RunPhase;
  proofHash?: string;
  settlementRef?: string;
  txHash?: string;
  /** true when the hire went through the real CROO store */
  store?: boolean;
}

export interface Birth {
  id: number;
  name: string;
  capabilityId: string;
  storeUrl: string | null;
}

export interface ProofLeaf {
  orderId: string;
  serviceId: string;
  agent: string;
  role: "hired" | "born" | "local";
  deliverableHash: string;
  payTxHash?: string;
  teeAttestation?: string;
}

export interface ProofTree {
  root: string;
  leaves: ProofLeaf[];
}

export interface LogLine {
  id: number;
  level: "info" | "value" | "warn";
  text: string;
}

export interface Payment {
  id: number;
  sellerName: string;
  amountUsdc: string;
  settlementRef?: string;
  txHash?: string;
}

export interface RunState {
  running: boolean;
  tasks: RunTask[];
  logs: LogLine[];
  payments: Payment[];
  births: Birth[];
  prooftree: ProofTree | null;
  done: boolean;
  spentUsdc?: string;
  refundedUsdc?: string;
  budgetUsdc?: string;
}

const empty: RunState = {
  running: false,
  tasks: [],
  logs: [],
  payments: [],
  births: [],
  prooftree: null,
  done: false,
};

/**
 * Subscribes to a project's live run over SSE and reduces the events into UI
 * state (tasks with phases, a log feed, and payments). Connect by passing a
 * project id; pass null to reset.
 */
export function useRun(projectId: string | null): RunState {
  const [state, setState] = useState<RunState>(empty);
  const seq = useRef(0);

  const push = useCallback((patch: (s: RunState) => RunState) => {
    setState((s) => patch(s));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setState(empty);
      return;
    }
    setState({ ...empty, running: true });
    const es = new EventSource(api.streamUrl(projectId));

    es.onmessage = (ev) => {
      let e: Record<string, unknown>;
      try {
        e = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (e.type) {
        case "plan":
          push((s) => ({ ...s, budgetUsdc: String(e.budgetUsdc ?? "") }));
          break;
        case "thread": {
          const t = e.thread as Record<string, unknown>;
          const rt: RunTask = {
            id: String(t.id),
            idx: Number(t.idx ?? 0),
            sellerName: String(t.sellerName),
            capabilityId: String(t.capabilityId),
            priceUsdc: String(t.priceUsdc ?? ""),
            phase: String(t.phase) as RunPhase,
            proofHash: t.proofHash ? String(t.proofHash) : undefined,
            settlementRef: t.settlementRef ? String(t.settlementRef) : undefined,
            txHash: t.txHash ? String(t.txHash) : undefined,
            store: Boolean(t.store),
          };
          push((s) => {
            const i = s.tasks.findIndex((x) => x.id === rt.id);
            const tasks = s.tasks.slice();
            if (i === -1) tasks.push(rt);
            else tasks[i] = { ...tasks[i], ...rt };
            tasks.sort((a, b) => a.idx - b.idx);
            return { ...s, tasks };
          });
          break;
        }
        case "log":
          push((s) => ({
            ...s,
            logs: [
              ...s.logs,
              {
                id: seq.current++,
                level: (e.level as LogLine["level"]) ?? "info",
                text: String(e.text ?? ""),
              },
            ],
          }));
          break;
        case "settle":
          push((s) => ({
            ...s,
            payments: [
              ...s.payments,
              {
                id: seq.current++,
                sellerName: String(e.sellerName ?? ""),
                amountUsdc: String(e.amountUsdc ?? ""),
                settlementRef: e.settlementRef ? String(e.settlementRef) : undefined,
                txHash: e.txHash ? String(e.txHash) : undefined,
              },
            ],
          }));
          break;
        case "birth": {
          const a = e.agent as Record<string, unknown>;
          push((s) => ({
            ...s,
            births: [
              ...s.births,
              {
                id: seq.current++,
                name: String(a?.name ?? ""),
                capabilityId: String(a?.capabilityId ?? ""),
                storeUrl: a?.storeUrl ? String(a.storeUrl) : null,
              },
            ],
          }));
          break;
        }
        case "prooftree":
          push((s) => ({
            ...s,
            prooftree: {
              root: String(e.root ?? "0x0"),
              leaves: Array.isArray(e.leaves) ? (e.leaves as ProofLeaf[]) : [],
            },
          }));
          break;
        case "done":
          push((s) => ({
            ...s,
            done: true,
            running: false,
            spentUsdc: String(e.spentUsdc ?? ""),
            refundedUsdc: String(e.refundedUsdc ?? ""),
            budgetUsdc: String(e.budgetUsdc ?? s.budgetUsdc ?? ""),
          }));
          break;
        case "end":
          es.close();
          push((s) => ({ ...s, running: false }));
          break;
      }
    };

    es.onerror = () => {
      // The server ends the stream after "done"; treat errors as stream close.
      es.close();
      push((s) => ({ ...s, running: false }));
    };

    return () => es.close();
  }, [projectId, push]);

  return state;
}

/** Convert server Task rows (from GET /project) into RunTask shape. */
export function tasksFromDetail(threads: Task[]): RunTask[] {
  return threads.map((t, i) => ({
    id: t.id,
    idx: i,
    sellerName: t.sellerName,
    capabilityId: t.capabilityId,
    priceUsdc: t.priceUsdc,
    phase: t.phase as RunPhase,
    proofHash: t.proofHash ?? undefined,
    settlementRef: t.settlementRef ?? undefined,
    txHash: t.txHash ?? undefined,
  }));
}
