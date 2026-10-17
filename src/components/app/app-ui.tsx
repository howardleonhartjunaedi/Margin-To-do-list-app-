"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useToday } from "@/lib/use-today";

export interface QuickAddDefaults {
  projectId?: string | null;
  dueDate?: string | null;
}

interface AppUI {
  today: string;
  quickAdd: { open: boolean; defaults: QuickAddDefaults };
  openQuickAdd: (defaults?: QuickAddDefaults) => void;
  closeQuickAdd: () => void;
  /** Defaults implied by the current page (Today → due today; a project → that project). */
  contextDefaults: QuickAddDefaults;
  openTaskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
}

const Ctx = createContext<AppUI | null>(null);

export function AppUIProvider({ children }: { children: React.ReactNode }) {
  const today = useToday();
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [quickAdd, setQuickAdd] = useState<AppUI["quickAdd"]>({ open: false, defaults: {} });

  const contextDefaults = useMemo<QuickAddDefaults>(() => {
    if (pathname === "/today") return { dueDate: today };
    const m = pathname.match(/^\/project\/([^/]+)/);
    if (m) return { projectId: decodeURIComponent(m[1]) };
    return {};
  }, [pathname, today]);

  // The open task lives in the URL (?task=id) so it's linkable and Back closes it.
  const openTaskId = params.get("task");
  const openTask = useCallback(
    (id: string) => {
      const p = new URLSearchParams(params);
      p.set("task", id);
      router.push(`${pathname}?${p}`, { scroll: false });
    },
    [params, pathname, router],
  );
  const closeTask = useCallback(() => {
    const p = new URLSearchParams(params);
    p.delete("task");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const value = useMemo<AppUI>(
    () => ({
      today,
      quickAdd,
      openQuickAdd: (defaults) => setQuickAdd({ open: true, defaults: defaults ?? contextDefaults }),
      closeQuickAdd: () => setQuickAdd((q) => ({ ...q, open: false })),
      contextDefaults,
      openTaskId,
      openTask,
      closeTask,
    }),
    [today, quickAdd, contextDefaults, openTaskId, openTask, closeTask],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppUI() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppUI must be used inside <AppUIProvider>");
  return v;
}
