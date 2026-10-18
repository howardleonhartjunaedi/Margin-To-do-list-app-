"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { clientId } from "@/lib/api";

interface ChangeEvent {
  type: "task" | "project" | "members" | "comment" | "notification";
  id?: string;
  taskId?: string;
  projectId?: string | null;
  origin?: string | null;
}

/** Built per host (next.config.ts): "poll" where the server can't hold a stream open. */
const POLLING = process.env.NEXT_PUBLIC_REALTIME === "poll";
const POLL_MS = 15_000;
/** Away longer than this and the server may have pruned notices we missed: refresh everything. */
const STALE_MS = 5 * 60_000;

/**
 * Keeps every open tab (yours and your collaborators') in step: on a change notice,
 * refetch exactly what's affected. Our own changes are already applied optimistically,
 * so their echo is ignored. Notices arrive over a stream (reconnects on its own; after a
 * gap, refreshes everything) or, on serverless hosts, by polling while the tab is visible.
 */
export function Realtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let es: EventSource | null = null;
    let lastError = 0;
    const pending = new Set<string>();
    let flush: ReturnType<typeof setTimeout> | undefined;
    const invalidate = (...keys: string[]) => {
      keys.forEach((k) => pending.add(k));
      clearTimeout(flush);
      // Batch bursts (a bulk move sends many events) into one refetch round.
      flush = setTimeout(() => {
        for (const k of pending) qc.invalidateQueries({ queryKey: JSON.parse(k) });
        pending.clear();
      }, 150);
    };
    const k = (...parts: unknown[]) => JSON.stringify(parts);

    const handle = (e: ChangeEvent) => {
      if (e.origin && e.origin === clientId) return;
      switch (e.type) {
        case "task":
          invalidate(k("tasks"), k("counts"), k("projects"));
          if (e.id) invalidate(k("task", e.id));
          break;
        case "project":
          invalidate(k("projects"), k("tasks"), k("counts"));
          break;
        case "members":
          invalidate(k("projects"), k("members", e.projectId), k("tasks"));
          break;
        case "comment":
          if (e.taskId) invalidate(k("comments", e.taskId), k("task", e.taskId));
          invalidate(k("tasks"));
          break;
        case "notification":
          invalidate(k("notifications"));
          break;
      }
    };

    if (POLLING) {
      let cursor: number | null = null;
      let lastOk = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let busy = false;
      const poll = async () => {
        clearTimeout(timer);
        if (busy || document.hidden || !navigator.onLine) return;
        busy = true;
        try {
          const stale = cursor !== null && Date.now() - lastOk > STALE_MS;
          const res = await fetch(cursor === null || stale ? "/api/changes" : `/api/changes?since=${cursor}`, { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as { cursor: number; events: ChangeEvent[]; more: boolean };
            if (stale || data.more) qc.invalidateQueries();
            else data.events.forEach(handle);
            cursor = data.cursor;
            lastOk = Date.now();
          }
        } catch {
          // Offline or a blip: try again next round.
        } finally {
          busy = false;
          if (!document.hidden) timer = setTimeout(poll, POLL_MS);
        }
      };
      const wake = () => void poll();
      document.addEventListener("visibilitychange", wake);
      window.addEventListener("online", wake);
      window.addEventListener("focus", wake);
      void poll();
      return () => {
        clearTimeout(flush);
        clearTimeout(timer);
        document.removeEventListener("visibilitychange", wake);
        window.removeEventListener("online", wake);
        window.removeEventListener("focus", wake);
      };
    }

    const connect = () => {
      es = new EventSource("/api/events");
      es.addEventListener("ready", () => {
        if (lastError) {
          // We may have missed changes while disconnected.
          qc.invalidateQueries();
          lastError = 0;
        }
      });
      es.addEventListener("change", (msg) => handle(JSON.parse((msg as MessageEvent).data) as ChangeEvent));
      es.onerror = () => {
        lastError = Date.now();
      };
    };
    connect();
    return () => {
      clearTimeout(flush);
      es?.close();
    };
  }, [qc]);
  return null;
}
