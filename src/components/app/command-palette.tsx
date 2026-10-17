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
      { id: "inbox", label: "Inbox", icon: Inbox, hint: "G I", run: go("/inbox") },
      { id: "today", label: "Today", icon: Sun, hint: "G T", run: go("/today") },
      { id: "upcoming", label: "Upcoming", icon: CalendarDays, hint: "G U", run: go("/upcoming") },
      { id: "calendar", label: "Calendar", icon: CalendarDays, hint: "G C", keywords: "month", run: go("/upcoming?layout=calendar") },
      { id: "timeline", label: "Timeline", icon: GanttChart, keywords: "gantt", run: go("/upcoming?layout=timeline") },
      { id: "matrix", label: "Eisenhower matrix", icon: Columns3, keywords: "priorities urgent important", run: go("/today?layout=matrix") },
      ...projects.map((p) => ({ id: `p-${p.id}`, label: p.name, dot: projectDot(p.color), hint: "Project", run: go(`/project/${p.id}`) })),
      ...filters.map((f) => ({ id: `f-${f.id}`, label: f.name, icon: ListFilter, hint: "Filter", run: go(`/filter/${f.id}`) })),
      { id: "focus", label: "Focus timer", icon: Timer, hint: "G F", keywords: "pomodoro concentrate", run: go("/focus") },
      { id: "habits", label: "Habits", icon: Repeat2, hint: "G H", keywords: "routine streak", run: go("/habits") },
      { id: "stats", label: "Stats", icon: ChartColumn, keywords: "statistics productivity charts", run: go("/stats") },
      { id: "plan", label: "Plan my day", icon: Sunrise, keywords: "morning planning", run: go("/plan") },
      { id: "review", label: "Review my day", icon: Moon, keywords: "evening reflection", run: go("/review") },
      { id: "settings", label: "Settings", icon: Settings, hint: "G S", keywords: "reminders notifications quiet digest time zone", run: go("/settings") },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, filters],
  );

  const actions: Item[] = [
    { id: "add", label: "Add a task", icon: Plus, hint: "Q", keywords: "new create", run: run(() => openQuickAdd()) },
    {
      id: "theme",
      label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      icon: resolvedTheme === "dark" ? Sun : Moon,
      keywords: "theme dark light appearance",
      run: run(() => set("theme", resolvedTheme === "dark" ? "light" : "dark")),
    },
    { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, hint: "?", keywords: "help keys", run: run(() => setShortcutsOpen(true)) },
    {
      id: "signout",
      label: "Sign out",
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
  const projectName = (id: string | null) => (id ? projects.find((p) => p.id === id)?.name : "Inbox");

  return (
    <DialogPrimitive.Root open={palette.open} onOpenChange={(o) => !o && closePalette()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-3 top-[10vh] z-40 mx-auto max-w-xl overflow-hidden rounded-md bg-raised shadow-3 ring-1 ring-line outline-none [--pop-y:-8px] data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Command shouldFilter={false} loop value={selected} onValueChange={setSelected} label="Command palette" className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Icon icon={Search} className="text-ink-3" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search tasks, go to a project, run a command…"
                className="h-13 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
              />
              {loading && <span className="skeleton h-1 w-6" aria-label="Searching" />}
            </div>
            <Command.List className="max-h-[min(60vh,440px)] overflow-y-auto p-1.5" data-lenis-prevent>
              <Command.Empty className="px-3 py-8 text-center text-sm text-ink-3">
                {q.length < 2 ? "Type to search your tasks." : loading ? "Searching…" : `Nothing found for “${query.trim()}”.`}
              </Command.Empty>

              {/* Found tasks first: Enter opens the best match. */}
              {hits.length > 0 && (
                <Group heading="Tasks">
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
                          {h.snippet ?? [h.parentId ? "Subtask" : projectName(h.projectId), h.dueDate && formatDue(h.dueDate, today)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </Command.Item>
                  ))}
                </Group>
              )}

              {q && (
                <Group heading="Create">
                  <Row
                    value="create-task"
                    icon={Plus}
                    label={`Add task “${query.trim()}”`}
                    hint="↵"
                    onSelect={run(() => openQuickAdd({ text: query.trim() }))}
                  />
                  <Row
                    value="create-project"
                    icon={FolderPlus}
                    label={`New project “${query.trim()}”`}
                    onSelect={run(async () => {
                      const id = crypto.randomUUID();
                      router.push(`/project/${id}`);
                      await projectActions.create({ id, name: query.trim() });
                    })}
                  />
                </Group>
              )}

              {navShown.length > 0 && (
                <Group heading="Go to">
                  {navShown.map((i) => (
                    <Row key={i.id} value={i.id} icon={i.icon} dot={i.dot} label={i.label} hint={i.hint} onSelect={i.run} />
                  ))}
                </Group>
              )}
              {actionsShown.length > 0 && (
                <Group heading="Actions">
                  {actionsShown.map((i) => (
                    <Row key={i.id} value={i.id} icon={i.icon} label={i.label} hint={i.hint} onSelect={i.run} />
                  ))}
                </Group>
              )}
            </Command.List>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-xs text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> move
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>
                  <Icon icon={CornerDownLeft} size="xs" />
                </Kbd>{" "}
                open
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5">
                <Kbd>Esc</Kbd> close
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
