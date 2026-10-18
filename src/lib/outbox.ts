"use client";

import { useSyncExternalStore } from "react";
import { api, ApiError } from "./api";
import type { CreateTaskInput, UpdateTaskInput } from "./validation";

/*
 * Task changes made while offline. The optimistic UI already shows them; this keeps the
 * request so it can be replayed, in order, once the network is back — even after a reload.
 * Tasks carry client-generated ids, so a task created offline can be edited offline too.
 */

export type OutboxOp = { kind: "createTask"; id: string; input: CreateTaskInput & { id: string } } | { kind: "updateTask"; id: string; patch: UpdateTaskInput };

const KEY = "margin:outbox";
const listeners = new Set<() => void>();
let cache: OutboxOp[] | null = null;
let flushing: Promise<{ sent: number; failed: number }> | null = null;

function read(): OutboxOp[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as OutboxOp[];
  } catch {
    cache = [];
  }
  return cache;
}

function write(ops: OutboxOp[]) {
  cache = ops;
  try {
    if (ops.length) localStorage.setItem(KEY, JSON.stringify(ops));
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

export function enqueue(op: OutboxOp) {
  const ops = [...read()];
  const last = ops.at(-1);
  // Successive edits to the same task collapse into one request (never into one already being sent).
  const inFlight = flushing !== null && ops.length === 1;
  if (op.kind === "updateTask" && last?.kind === "updateTask" && last.id === op.id && !inFlight)
    ops[ops.length - 1] = { ...last, patch: { ...last.patch, ...op.patch } };
  else ops.push(op);
  write(ops);
}

/** The queued changes, oldest first. */
export const pendingOps = (): readonly OutboxOp[] => read();

export function clearOutbox() {
  write([]);
}

/** Replays queued changes in order. Stops at the first network failure; drops changes the server rejects. */
export function flushOutbox() {
  flushing ??= (async () => {
    let sent = 0;
    let failed = 0;
    try {
      while (read().length) {
        const [op] = read();
        try {
          if (op.kind === "createTask") await api.createTask(op.input);
          else await api.updateTask(op.id, op.patch);
          sent++;
        } catch (e) {
          if (e instanceof ApiError && e.status === 0) break; // still offline — try again later
          failed++; // rejected (deleted elsewhere, lost access…): don't block the rest behind it
        }
        write(read().slice(1));
      }
    } finally {
      flushing = null;
    }
    return { sent, failed };
  })();
  return flushing;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null; // another tab changed it
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};

/** How many changes are waiting to be sent. */
export function useOutboxSize() {
  return useSyncExternalStore(
    subscribe,
    () => read().length,
    () => 0,
  );
}

export const isOffline = (e: unknown) => e instanceof ApiError && e.status === 0;
