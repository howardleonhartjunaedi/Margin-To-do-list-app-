"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useTaskActions } from "@/lib/data";
import * as F from "@/lib/focus";
import type { Task } from "@/lib/types";

/*
 * The focus timer lives on the client: persisted to localStorage so a reload or a second
 * tab picks it up, recorded to the server when a phase ends or is stopped.
 */

export interface FocusPrefs extends F.FocusSettings {
  autoStartBreaks: boolean;
  sound: boolean;
}
const DEFAULT_PREFS: FocusPrefs = { ...F.DEFAULT_FOCUS, autoStartBreaks: true, sound: true };
const STATE_KEY = "margin:focus";
const PREFS_KEY = "margin:focus-prefs";
const RECORDED_KEY = "margin:focus-recorded";

export type RunningTimer = F.TimerState & { taskTitle?: string | null };

interface Ctx {
  timer: RunningTimer | null;
  now: number;
  prefs: FocusPrefs;
  setPrefs: (p: Partial<FocusPrefs>) => void;
  start: (phase?: F.Phase, task?: Pick<Task, "id" | "title"> | null) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skip: () => void;
  adjust: (minutes: number) => void;
  setTask: (task: Pick<Task, "id" | "title"> | null) => void;
  taskTitle: string | null;
}

const FocusContext = createContext<Ctx | null>(null);

const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {}
};

/** Two soft tones. No audio file, no network. */
function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {}
}

function systemNotify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || document.visibilityState === "visible") return;
  try {
    new Notification(title, { body, tag: "margin-focus" });
  } catch {}
}

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [timer, setTimer] = useState<(F.TimerState & { taskTitle?: string | null }) | null>(null);
  const [prefs, setPrefsState] = useState<FocusPrefs>(DEFAULT_PREFS);
  const [now, setNow] = useState(() => Date.now());
  const qc = useQueryClient();
  const actions = useTaskActions();
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // Restore, and follow other tabs.
  useEffect(() => {
    setTimer(read(STATE_KEY, null));
    setPrefsState({ ...DEFAULT_PREFS, ...read(PREFS_KEY, {}) });
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATE_KEY) setTimer(read(STATE_KEY, null));
      if (e.key === PREFS_KEY) setPrefsState({ ...DEFAULT_PREFS, ...read(PREFS_KEY, {}) });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = useCallback((t: (F.TimerState & { taskTitle?: string | null }) | null) => {
    setTimer(t);
    write(STATE_KEY, t);
  }, []);

  /** Record a phase once, even if two tabs notice it ending at the same moment. */
  const record = useCallback(
    (t: F.TimerState, at: number, completed: boolean) => {
      const key = `${t.startedAt}-${t.phase}`;
      if (read<string | null>(RECORDED_KEY, null) === key) return;
      write(RECORDED_KEY, key);
      const actual = Math.round(Math.min(F.elapsed(t, at), t.durationMs) / 1000);
      if (actual < 60 && !completed) return; // a misclick isn't a session
      const ended = Math.min(at, t.startedAt + t.pausedMs + t.durationMs + (t.pausedAt ? at - t.pausedAt : 0));
      void api
        .recordFocus({
          taskId: t.taskId,
          kind: t.phase === "focus" ? "focus" : "break",
          plannedSeconds: Math.round(t.durationMs / 1000),
          actualSeconds: actual,
          completed,
          startedAt: new Date(t.startedAt).toISOString(),
          endedAt: new Date(ended).toISOString(),
        })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["stats"] });
          if (t.taskId) qc.invalidateQueries({ queryKey: ["task", t.taskId] });
        })
        .catch(() => {});
    },
    [qc],
  );

  // Tick once a second while running; handle the end of a phase.
  useEffect(() => {
    if (!timer || timer.pausedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!timer || timer.pausedAt || !F.isDone(timer, now)) return;
    record(timer, now, true);
    const wasFocus = timer.phase === "focus";
    const away = now - (timer.startedAt + timer.pausedMs + timer.durationMs) > 60_000;
    if (prefs.sound && !away) chime();
    const title = wasFocus ? "Focus session done." : "Break’s over.";
    const body = wasFocus ? "Take a breath — a break is up next." : "Ready for the next round when you are.";
    systemNotify(title, body);
    if (wasFocus && timer.taskId) {
      const taskId = timer.taskId;
      const taskTitle = timer.taskTitle ?? "this task";
      toast(away ? "Your focus session ended while you were away." : title, {
        description: `On “${taskTitle}”.`,
        action: {
          label: "Mark done",
          onClick: async () => {
            const { task } = await api.task(taskId);
            void actionsRef.current.complete(task);
          },
        },
      });
    } else toast(away ? "Your timer ended while you were away." : title);

    const following = F.next(timer, now, prefs);
    // Breaks can start themselves; focus waits for you.
    if (wasFocus && prefs.autoStartBreaks && !away) commit({ ...following, taskTitle: timer.taskTitle });
    else commit(null);
  }, [now, timer, prefs, record, commit]);

  // Countdown in the tab title while it runs.
  useEffect(() => {
    if (!timer) return;
    // Re-read the title each tick: Next replaces it on navigation.
    const strip = (t: string) => t.replace(/^[\d:]+ · (Focus|Break)( \(paused\))? · /, "");
    const label = `${timer.phase === "focus" ? "Focus" : "Break"}${timer.pausedAt ? " (paused)" : ""}`;
    document.title = `${F.clock(F.remaining(timer, now))} · ${label} · ${strip(document.title)}`;
    return () => {
      document.title = strip(document.title);
    };
  }, [timer, now]);

  const value = useMemo<Ctx>(
    () => ({
      timer,
      now,
      prefs,
      taskTitle: timer?.taskTitle ?? null,
      setPrefs: (p) =>
        setPrefsState((cur) => {
          const next = { ...cur, ...p };
          write(PREFS_KEY, next);
          return next;
        }),
      start: (phase = "focus", task) => {
        const t = Date.now();
        setNow(t);
        if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
        commit({ ...F.start(phase, t, prefs, task?.id ?? timer?.taskId ?? null, timer?.round ?? 0), taskTitle: task?.title ?? timer?.taskTitle ?? null });
      },
      pause: () => timer && commit({ ...F.pause(timer, Date.now()), taskTitle: timer.taskTitle }),
      resume: () => {
        const t = Date.now();
        setNow(t);
        if (timer) commit({ ...F.resume(timer, t), taskTitle: timer.taskTitle });
      },
      stop: () => {
        if (timer) record(timer, Date.now(), false);
        commit(null);
      },
      skip: () => {
        if (!timer) return;
        const t = Date.now();
        record(timer, t, false);
        setNow(t);
        commit({ ...F.next(timer, t, prefs), taskTitle: timer.taskTitle });
      },
      adjust: (m) => timer && commit({ ...F.adjust(timer, m, Date.now()), taskTitle: timer.taskTitle }),
      setTask: (task) => timer && commit({ ...timer, taskId: task?.id ?? null, taskTitle: task?.title ?? null }),
    }),
    [timer, now, prefs, commit, record],
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocus must be used inside <FocusProvider>");
  return ctx;
}
