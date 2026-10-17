"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { api, ApiError } from "./api";
import type { SavedFilter } from "./types";

const KEY = ["filters"] as const;
const failed = (e: unknown) => toast(e instanceof ApiError ? e.message : "Something went wrong. Your change wasn’t saved.");

export const useSavedFilters = () => useQuery({ queryKey: KEY, queryFn: api.filters });

export function useFilterActions() {
  const qc = useQueryClient();
  const set = (fn: (fs: SavedFilter[]) => SavedFilter[]) => qc.setQueryData<SavedFilter[]>(KEY, (fs) => fn(fs ?? []));
  return {
    create: async (input: { id: string; name: string; query: string }) => {
      const prev = qc.getQueryData(KEY);
      set((fs) => [...fs, { ...input, sortKey: "￿" }]);
      try {
        const saved = await api.createFilter(input);
        set((fs) => fs.map((f) => (f.id === saved.id ? saved : f)));
        toast(`Saved “${saved.name}”. It’s in the sidebar.`);
        return saved;
      } catch (e) {
        qc.setQueryData(KEY, prev);
        failed(e);
      }
    },
    update: async (id: string, patch: { name?: string; query?: string }) => {
      const prev = qc.getQueryData(KEY);
      set((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
      try {
        await api.updateFilter(id, patch);
        if (patch.query !== undefined) toast("Filter updated.");
      } catch (e) {
        qc.setQueryData(KEY, prev);
        failed(e);
      }
    },
    remove: async (id: string) => {
      const prev = qc.getQueryData(KEY);
      set((fs) => fs.filter((f) => f.id !== id));
      try {
        await api.deleteFilter(id);
        return true;
      } catch (e) {
        qc.setQueryData(KEY, prev);
        failed(e);
        return false;
      }
    },
  };
}
