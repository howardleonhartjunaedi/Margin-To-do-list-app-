"use client";

import { useMemo, useRef } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { ViewHeader } from "@/components/tasks/view-header";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TaskRowSkeleton } from "@/components/ui/states";
import { useTasks } from "@/lib/data";
import { applyFilter, EMPTY_FILTER, isEmptyFilter } from "@/lib/filters";
import type { Task, View } from "@/lib/types";
import { useHotkeys } from "@/lib/use-hotkeys";
import { Board } from "./board";
import { CalendarLayout } from "./calendar";
import { ActiveFilters, FilterButton, useFilterParam } from "./filter-bar";
import { LayoutBody, LayoutSwitcher, LAYOUTS, useLayout, type Layout } from "./layout-switcher";
import { Matrix } from "./matrix";
import { TimelineLayout } from "./timeline";
import { useT } from "@/i18n/client";

export interface ScopeProps {
  title: React.ReactNode;
  /** Header subline; gets the visible task count (null while loading or in date layouts). */
  sub: (count: number | null) => React.ReactNode;
  actions?: React.ReactNode;
  layouts: Layout[];
  /** Data for list, board and matrix. */
  listView: View;
  /** Calendar and timeline fetch by date range; scope them to one project if set. */
  projectId?: string;
  renderList: (tasks: Task[], filtered: boolean) => React.ReactNode;
  boardGroupByProject?: boolean;
  savedFilter?: { id: string; query: string };
  hideProjectFilter?: boolean;
  /** Shown between the header and the tasks (Today: intention, habits). */
  intro?: React.ReactNode;
}

/**
 * One place (Inbox, Today, a project, a saved filter…) seen through any of its layouts.
 * Layout and filter live in the URL, so every view is linkable.
 */
export function ScopeView(p: ScopeProps) {
  const { today } = useAppUI();
  const [layout, setLayout] = useLayout(p.layouts);
  const [filter, setFilter] = useFilterParam(p.savedFilter?.query);
  const q = useTasks(p.listView);
  const tasks = useMemo(() => applyFilter(q.data ?? [], filter, today), [q.data, filter, today]);
  const dated = layout === "calendar" || layout === "timeline";

  // Next keeps the previous page mounted (hidden) for instant Back; only the visible one listens.
  const root = useRef<HTMLDivElement>(null);
  useHotkeys(
    Object.fromEntries(
      p.layouts.map((l) => [`v ${LAYOUTS[l].key.toLowerCase()}`, () => setLayout(l)]),
    ) as Record<string, () => void>,
    { when: () => !!root.current && root.current.getClientRects().length > 0 },
  );

  const tf = useT().filter;
  let body: React.ReactNode;
  if (layout === "calendar") body = <CalendarLayout projectId={p.projectId} filter={filter} />;
  else if (layout === "timeline") body = <TimelineLayout projectId={p.projectId} filter={filter} />;
  else if (q.isPending) body = <TaskRowSkeleton rows={5} />;
  else if (q.isError)
    body = <ErrorState message={tf.cantReach(q.error.message)} onRetry={() => q.refetch()} />;
  else if (!isEmptyFilter(filter) && tasks.length === 0 && q.data.length > 0)
    body = (
      <EmptyState
        mark="∅"
        title={tf.nothingMatches}
        body={tf.hiddenBy(q.data.length)}
        action={
          <Button size="sm" onClick={() => setFilter(EMPTY_FILTER)}>
            {tf.clearFilter}
          </Button>
        }
      />
    );
  else if (layout === "board") body = <Board tasks={tasks} allowProjectGroup={!!p.boardGroupByProject} fixed={p.projectId ? { projectId: p.projectId } : undefined} />;
  else if (layout === "matrix") body = <Matrix tasks={tasks} hideProject={!!p.projectId} />;
  else body = p.renderList(tasks, !isEmptyFilter(filter));

  return (
    <div ref={root}>
      <ViewHeader
        title={p.title}
        sub={p.sub(dated || q.isPending ? null : tasks.filter((t) => !t.completedAt).length)}
        actions={
          <div className="flex flex-wrap items-center gap-1">
            <FilterButton filter={filter} onChange={setFilter} hideProjects={p.hideProjectFilter} />
            <LayoutSwitcher value={layout} onChange={setLayout} available={p.layouts} />
            {p.actions}
          </div>
        }
      />
      <ActiveFilters filter={filter} onChange={setFilter} savedId={p.savedFilter?.id} savedQuery={p.savedFilter?.query} />
      {p.intro}
      <LayoutBody layout={layout}>{body}</LayoutBody>
    </div>
  );
}
