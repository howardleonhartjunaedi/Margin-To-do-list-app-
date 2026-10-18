"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import {
  CalendarDays,
  ChartColumn,
  Columns3,
  CornerDownLeft,
  FolderPlus,
  GanttChart,
  Inbox,
  Keyboard,
  ListFilter,
  LogOut,
  Moon,
  Plus,
  Repeat2,
  Search,
  Settings,
  Sun,
  Sunrise,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePreferences } from "@/components/providers/preferences";
import { Kbd } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { useProjectActions, useProjects } from "@/lib/data";
import { useSavedFilters } from "@/lib/data-filters";
import { formatDue } from "@/lib/dates";
import { projectDot } from "@/lib/project-colors";
import type { SearchHit } from "@/lib/types";
import { useAppUI } from "./app-ui";
import { useT } from "@/i18n/client";

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  dot?: string;
  keywords?: string;
  run: () => void;
}

function useSearch(query: string) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      api
        .search(q, ctrl.signal)
        .then(setHits)
        .catch(() => {})
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);
  return { hits, loading };
}

/**
 * ⌘K. Search tasks, jump anywhere, run any action — keyboard first.
 * Static items filter locally as you type; task search comes from the server.
 */
export function CommandPalette() {
  const { palette, closePalette, openQuickAdd, openTask, today, setShortcutsOpen } = useAppUI();
  const router = useRouter();
  const { set, resolvedTheme } = usePreferences();
  const projects = useProjects().data ?? [];
  const filters = useSavedFilters().data ?? [];
  const projectActions = useProjectActions();
  const tr = useT();
  const t = tr.palette;
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (palette.open) setQuery(palette.query);
  }, [palette.open, palette.query]);
  const { hits, loading } = useSearch(query);
  // Keep the highlight on the most useful row as results stream in: the best task match,
  // else "Add task", else the first destination.
  const [selected, setSelected] = useState("");
  useEffect(() => {
    setSelected(hits.length ? `task-${hits[0].id}` : query.trim() ? "create-task" : "inbox");
  }, [hits, query]);

  const run = (fn: () => void) => () => {
    closePalette();
    fn();
  };
  const go = (href: string) => run(() => router.push(href));

  const nav: Item[] = useMemo(
    () => [
      { id: "inbox", label: tr.nav.inbox, icon: Inbox, hint: "G I", run: go("/inbox") },
      { id: "today", label: tr.nav.today, icon: Sun, hint: "G T", run: go("/today") },
      { id: "upcoming", label: tr.nav.upcoming, icon: CalendarDays, hint: "G U", run: go("/upcoming") },
      { id: "calendar", label: t.calendar, icon: CalendarDays, hint: "G C", keywords: t.kw.calendar, run: go("/upcoming?layout=calendar") },
      { id: "timeline", label: t.timeline, icon: GanttChart, keywords: t.kw.timeline, run: go("/upcoming?layout=timeline") },
      { id: "matrix", label: t.matrix, icon: Columns3, keywords: t.kw.matrix, run: go("/today?layout=matrix") },
      ...projects.map((p) => ({ id: `p-${p.id}`, label: p.name, dot: projectDot(p.color), hint: t.project, run: go(`/project/${p.id}`) })),
      ...filters.map((f) => ({ id: `f-${f.id}`, label: f.name, icon: ListFilter, hint: t.filter, run: go(`/filter/${f.id}`) })),
      { id: "focus", label: t.focusTimer, icon: Timer, hint: "G F", keywords: t.kw.focus, run: go("/focus") },
      { id: "habits", label: tr.nav.habits, icon: Repeat2, hint: "G H", keywords: t.kw.habits, run: go("/habits") },
      { id: "stats", label: tr.nav.stats, icon: ChartColumn, keywords: t.kw.stats, run: go("/stats") },
      { id: "plan", label: t.planMyDay, icon: Sunrise, keywords: t.kw.plan, run: go("/plan") },
      { id: "review", label: t.reviewMyDay, icon: Moon, keywords: t.kw.review, run: go("/review") },
      { id: "settings", label: tr.nav.settings, icon: Settings, hint: "G S", keywords: t.kw.settings, run: go("/settings") },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, filters, tr],
  );

  const actions: Item[] = [
    { id: "add", label: t.addTask, icon: Plus, hint: "Q", keywords: t.kw.add, run: run(() => openQuickAdd()) },
    {
      id: "theme",
      label: resolvedTheme === "dark" ? t.toLight : t.toDark,
      icon: resolvedTheme === "dark" ? Sun : Moon,
      keywords: t.kw.theme,
      run: run(() => set("theme", resolvedTheme === "dark" ? "light" : "dark")),
    },
    { id: "shortcuts", label: t.shortcuts, icon: Keyboard, hint: "?", keywords: t.kw.shortcuts, run: run(() => setShortcutsOpen(true)) },
    {
      id: "signout",
      label: tr.nav.signOut,
      icon: LogOut,
      run: run(async () => {
        await signOut();
        router.replace("/sign-in");
      }),
    },
  ];

  const q = query.trim().toLowerCase();
  const match = (i: Item) => !q || `${i.label} ${i.keywords ?? ""} ${i.hint ?? ""}`.toLowerCase().includes(q);
  const navShown = nav.filter(match).slice(0, q ? 6 : 20);
  const actionsShown = actions.filter(match);
  const projectName = (id: string | null) => (id ? projects.find((p) => p.id === id)?.name : tr.nav.inbox);

  return (
    <DialogPrimitive.Root open={palette.open} onOpenChange={(o) => !o && closePalette()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-3 top-[10vh] z-40 mx-auto max-w-xl overflow-hidden rounded-md bg-raised shadow-3 ring-1 ring-line outline-none [--pop-y:-8px] data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
        >
          <DialogPrimitive.Title className="sr-only">{t.title}</DialogPrimitive.Title>
          <Command shouldFilter={false} loop value={selected} onValueChange={setSelected} label={t.title} className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Icon icon={Search} className="text-ink-3" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t.placeholder}
                className="h-13 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
              />
              {loading && <span className="skeleton h-1 w-6" aria-label={t.searching} />}
            </div>
            <Command.List className="max-h-[min(60vh,440px)] overflow-y-auto p-1.5" data-lenis-prevent>
              <Command.Empty className="px-3 py-8 text-center text-sm text-ink-3">
                {q.length < 2 ? t.typeToSearch : loading ? t.searchingEllipsis : t.nothingFound(query.trim())}
              </Command.Empty>

              {/* Found tasks first: Enter opens the best match. */}
              {hits.length > 0 && (
                <Group heading={t.tasks}>
                  {hits.map((h) => (
                    <Command.Item
                      key={h.id}
                      value={`task-${h.id}`}
                      onSelect={run(() => openTask(h.id))}
                      className="flex cursor-default items-start gap-3 rounded-sm px-2.5 py-2 text-sm text-ink data-[selected=true]:bg-sunken"
                    >
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full ring-[1.5px] ring-inset", h.completed ? "bg-ink-3 ring-ink-3" : "ring-control")} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate", h.completed && "text-ink-3 line-through")}>{h.title}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {h.snippet ?? [h.parentId ? t.subtask : projectName(h.projectId), h.dueDate && formatDue(h.dueDate, today)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </Command.Item>
                  ))}
                </Group>
              )}

              {q && (
                <Group heading={t.create}>
                  <Row
                    value="create-task"
                    icon={Plus}
                    label={t.addTaskNamed(query.trim())}
                    hint="↵"
                    onSelect={run(() => openQuickAdd({ text: query.trim() }))}
                  />
                  <Row
                    value="create-project"
                    icon={FolderPlus}
                    label={t.newProjectNamed(query.trim())}
                    onSelect={run(async () => {
                      const id = crypto.randomUUID();
                      router.push(`/project/${id}`);
                      await projectActions.create({ id, name: query.trim() });
                    })}
                  />
                </Group>
              )}

              {navShown.length > 0 && (
                <Group heading={t.goTo}>
                  {navShown.map((i) => (
                    <Row key={i.id} value={i.id} icon={i.icon} dot={i.dot} label={i.label} hint={i.hint} onSelect={i.run} />
                  ))}
                </Group>
              )}
              {actionsShown.length > 0 && (
                <Group heading={t.actions}>
                  {actionsShown.map((i) => (
                    <Row key={i.id} value={i.id} icon={i.icon} label={i.label} hint={i.hint} onSelect={i.run} />
                  ))}
                </Group>
              )}
            </Command.List>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-xs text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> {t.move}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>
                  <Icon icon={CornerDownLeft} size="xs" />
                </Kbd>{" "}
                {t.open}
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5">
                <Kbd>Esc</Kbd> {t.close}
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase"
    >
      {children}
    </Command.Group>
  );
}

function Row({
  value,
  icon,
  dot,
  label,
  hint,
  onSelect,
}: {
  value: string;
  icon?: LucideIcon;
  dot?: string;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-10 cursor-default items-center gap-3 rounded-sm px-2.5 text-sm text-ink data-[selected=true]:bg-sunken"
    >
      <span className="flex w-4 justify-center text-ink-3">
        {icon ? <Icon icon={icon} /> : <span className={cn("size-2 rounded-full", dot)} />}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="font-mono text-2xs text-ink-3">{hint}</span>}
    </Command.Item>
  );
}
