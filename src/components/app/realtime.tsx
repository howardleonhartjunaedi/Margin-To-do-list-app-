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

/**
 * Keeps every open tab (yours and your collaborators') in step: on a change notice,
 * refetch exactly what's affected. Our own changes are already applied optimistically,
 * so their echo is ignored. Reconnects on its own; after a gap, refreshes everything.
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

    const connect = () => {
      es = new EventSource("/api/events");
      es.addEventListener("ready", () => {
        if (lastError) {
          // We may have missed changes while disconnected.
          qc.invalidateQueries();
          lastError = 0;
        }
      });
      es.addEventListener("change", (msg) => {
        const e = JSON.parse((msg as MessageEvent).data) as ChangeEvent;
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
      });
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
