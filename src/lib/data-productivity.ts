"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast, toastWithUndo } from "@/components/ui/toast";
import { api, ApiError } from "./api";
import type { DayNote, Habit } from "./types";

const failed = (e: unknown) => toast(e instanceof ApiError ? e.message : "Something went wrong. Your change wasn’t saved.");

export const pkeys = {
  habits: ["habits"] as const,
  day: (date: string) => ["day", date] as const,
  stats: (from: string, to: string) => ["stats", from, to] as const,
};

/* ------------------------------ Habits ------------------------------ */

export const useHabits = () => useQuery({ queryKey: pkeys.habits, queryFn: api.habits });

export function useHabitActions() {
  const qc = useQueryClient();
  const set = (fn: (hs: Habit[]) => Habit[]) => qc.setQueryData<Habit[]>(pkeys.habits, (hs) => fn(hs ?? []));
  const guarded = async <T,>(run: () => Promise<T>) => {
    const prev = qc.getQueryData(pkeys.habits);
    try {
      return await run();
    } catch (e) {
      qc.setQueryData(pkeys.habits, prev);
      failed(e);
    }
  };
  return {
    toggle: (h: Habit, date: string) => {
      const done = !h.checks.includes(date);
      set((hs) => hs.map((x) => (x.id === h.id ? { ...x, checks: done ? [...x.checks, date].sort() : x.checks.filter((d) => d !== date) } : x)));
      return guarded(() => api.setHabitCheck(h.id, date, done));
    },
    create: (input: { name: string; color?: string; targetPerWeek?: number }) => {
      const id = crypto.randomUUID();
      set((hs) => [...hs, { id, name: input.name, color: (input.color ?? "ink") as Habit["color"], targetPerWeek: input.targetPerWeek ?? 7, sortKey: "￿", createdOn: new Date().toLocaleDateString("en-CA"), checks: [] }]);
      return guarded(async () => qc.setQueryData(pkeys.habits, await api.createHabit({ id, ...input })));
    },
    update: (id: string, patch: { name?: string; color?: string; targetPerWeek?: number }) => {
      set((hs) => hs.map((x) => (x.id === id ? ({ ...x, ...patch } as Habit) : x)));
      return guarded(() => api.updateHabit(id, patch));
    },
    archive: (h: Habit) => {
      set((hs) => hs.filter((x) => x.id !== h.id));
      toastWithUndo(`Archived “${h.name}”. Its history is kept.`, () => {
        set((hs) => [...hs, h].sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1)));
        void guarded(() => api.updateHabit(h.id, { archived: false }));
      });
      return guarded(() => api.updateHabit(h.id, { archived: true }));
    },
    remove: (h: Habit) => {
      set((hs) => hs.filter((x) => x.id !== h.id));
      return guarded(() => api.deleteHabit(h.id));
    },
  };
}

/* ------------------------------ Days ------------------------------ */

export const useDay = (date: string) => useQuery({ queryKey: pkeys.day(date), queryFn: () => api.day(date) });

export function useSaveDay(date: string) {
  const qc = useQueryClient();
  return async (patch: Parameters<typeof api.saveDay>[1]) => {
    const prev = qc.getQueryData<DayNote>(pkeys.day(date));
    if (prev) qc.setQueryData<DayNote>(pkeys.day(date), { ...prev, ...patch });
    try {
      const saved = await api.saveDay(date, patch);
      qc.setQueryData(pkeys.day(date), saved);
      return saved;
    } catch (e) {
      qc.setQueryData(pkeys.day(date), prev);
      failed(e);
    }
  };
}

/* ------------------------------ Stats ------------------------------ */

/** Keeps the previous range on screen while a new one loads (charts dim instead of flashing). */
export const useStats = (from: string, to: string) =>
  useQuery({ queryKey: pkeys.stats(from, to), queryFn: () => api.stats(from, to), placeholderData: keepPreviousData });
