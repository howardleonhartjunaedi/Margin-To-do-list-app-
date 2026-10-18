"use client";

import { SortInboxButton } from "@/components/ai/ai-suggestions";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { ProjectForm } from "@/components/app/project-form";
import { ScopeView } from "@/components/views/scope";
import { ShareButton } from "@/components/sharing/share-dialog";
import { DayPrompt } from "@/components/day/day-flows";
import { TodayHabits } from "@/components/habits/habits-view";
import { Kbd } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { toastWithUndo } from "@/components/ui/toast";
import { useProjectActions, useProjects, useTaskActions } from "@/lib/data";
import { useFilterActions, useSavedFilters } from "@/lib/data-filters";
import { addDays, dayHeading, formatDate } from "@/lib/dates";
import { describeFilter, decodeFilter } from "@/lib/filters";
import { projectDot } from "@/lib/project-colors";
import { cn } from "@/lib/cn";
import type { Task, View } from "@/lib/types";
import { useT } from "@/i18n/client";
import { InlineAdd } from "./inline-add";
import { TaskList, type TaskGroup } from "./task-list";

const LONG: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };

/* ------------------------------ Today ------------------------------ */

export function TodayView() {
  const { today } = useAppUI();
  const view = useMemo<View>(() => ({ kind: "today", today }), [today]);
  const actions = useTaskActions();
  const tr = useT();
  const t = tr.views;
  const count = (n: number | null) => (n === null ? "" : t.taskCount(n));

  return (
    <ScopeView
      title={tr.nav.today}
      sub={(n) => [formatDate(today, LONG), count(n)].filter(Boolean).join(" · ")}
      layouts={["list", "board", "matrix"]}
      listView={view}
      boardGroupByProject
      intro={
        <>
          <DayPrompt />
          <TodayHabits />
        </>
      }
      renderList={(tasks) => {
        const overdue = tasks.filter((t) => t.dueDate! < today);
        const due = tasks.filter((t) => t.dueDate === today);
        const moveAll = () => {
          const moved = overdue.filter((t) => !t.completedAt);
          moved.forEach((t) => void actions.update(t, { dueDate: today }));
          toastWithUndo(t.movedToToday(moved.length), () =>
            moved.forEach((t) => void actions.update({ ...t, dueDate: today }, { dueDate: t.dueDate })),
          );
        };
        const groups: TaskGroup[] = [
          {
            key: "overdue",
            title: t.overdue,
            tone: "danger",
            action: (
              <Button size="sm" variant="ghost" onClick={moveAll}>
                {t.moveAllToToday}
              </Button>
            ),
            tasks: overdue,
          },
          { key: "today", title: overdue.some((x) => !x.completedAt) ? tr.nav.today : undefined, hideDate: true, tasks: due },
        ];
        return (
          <TaskList
            view={view}
            groups={groups}
            empty={
              <EmptyState
                mark="*"
                title={t.todayEmpty}
                body={<>{t.todayEmptyBody(<Kbd key="k">Q</Kbd>)}</>}
              />
            }
            cleared={<EmptyState mark="Fin." title={t.todayClear} body={t.todayClearBody} />}
            footer={<InlineAdd dueDate={today} />}
          />
        );
      }}
    />
  );
}

/* ------------------------------ Inbox ------------------------------ */

export function InboxView() {
  const view = useMemo<View>(() => ({ kind: "inbox" }), []);
  const tr = useT();
  const t = tr.views;
  const count = (n: number | null) => (n === null ? "" : t.taskCount(n));
  return (
    <ScopeView
      title={tr.nav.inbox}
      sub={count}
      actions={<SortInboxButton />}
      layouts={["list", "board", "matrix"]}
      listView={view}
      hideProjectFilter
      renderList={(tasks) => (
        <TaskList
          view={view}
          groups={[{ key: "all", tasks }]}
          empty={
            <EmptyState
              mark="¶"
              title={t.inboxEmpty}
              body={<>{t.inboxEmptyBody(<Kbd key="k">Q</Kbd>)}</>}
            />
          }
          cleared={<EmptyState mark="Fin." title={t.inboxZero} body={t.inboxZeroBody} />}
          footer={<InlineAdd />}
        />
      )}
    />
  );
}

/* ------------------------------ Upcoming ------------------------------ */

const WEEKS = 4;

export function UpcomingView() {
  const { today } = useAppUI();
  const [weeks, setWeeks] = useState(WEEKS);
  const view = useMemo<View>(() => ({ kind: "upcoming", today, to: addDays(today, weeks * 7) }), [today, weeks]);
  const through = addDays(today, weeks * 7 - 1);
  const tr = useT();
  const t = tr.views;

  return (
    <ScopeView
      title={tr.nav.upcoming}
      sub={(n) => (n === null ? "" : t.through(formatDate(through, LONG), t.taskCount(n)))}
      layouts={["list", "calendar", "timeline", "board"]}
      listView={view}
      boardGroupByProject
      renderList={(tasks) => {
        const overdue = tasks.filter((t) => t.dueDate! < today);
        const byDay = new Map<string, Task[]>();
        for (const t of tasks) if (t.dueDate! >= today) byDay.set(t.dueDate!, [...(byDay.get(t.dueDate!) ?? []), t]);
        const groups: TaskGroup[] = [
          { key: "overdue", title: t.overdue, tone: "danger", tasks: overdue },
          ...[...byDay].map(([date, list]) => {
            const h = dayHeading(date, today);
            return { key: date, title: h.title, sub: h.sub, hideDate: true, tasks: list };
          }),
        ];
        return (
          <TaskList
            view={view}
            groups={groups}
            empty={<EmptyState mark="→" title={t.upcomingEmpty(weeks)} body={t.upcomingEmptyBody} />}
            footer={
              <Button variant="ghost" className="self-start" onClick={() => setWeeks((w) => w + WEEKS)}>
                {t.showFollowing(WEEKS)}
              </Button>
            }
          />
        );
      }}
    />
  );
}

/* ------------------------------ Project ------------------------------ */

export function ProjectView({ id }: { id: string }) {
  const view = useMemo<View>(() => ({ kind: "project", id }), [id]);
  const projects = useProjects();
  const project = projects.data?.find((p) => p.id === id);
  const t = useT().views;
  const count = (n: number | null) => (n === null ? "" : t.taskCount(n));

  if (projects.isSuccess && !project) {
    return <EmptyState mark="?" title={t.projectMissing} body={t.projectMissingBody} />;
  }

  return (
    <ScopeView
      title={
        <span className="inline-flex items-center gap-3">
          {project && <span className={cn("size-3 rounded-full", projectDot(project.color))} aria-hidden />}
          {project?.name ?? " "}
        </span>
      }
      sub={count}
      actions={
        project && (
          <>
            <ShareButton projectId={project.id} projectName={project.name} memberCount={project.memberCount} />
            {project.role === "owner" && <ProjectMenu id={project.id} name={project.name} color={project.color} count={project.openCount} />}
          </>
        )
      }
      layouts={["list", "board", "calendar", "timeline", "matrix"]}
      listView={view}
      projectId={id}
      hideProjectFilter
      renderList={(tasks) => (
        <TaskList
          view={view}
          groups={[{ key: "all", tasks }]}
          empty={
            <EmptyState
              mark="§"
              title={t.projectEmpty(project?.name)}
              body={
                <>
                  {t.projectEmptyBody(
                    <span key="tag" className="font-mono text-xs">
                      #{project?.name.toLowerCase().replace(/\s+/g, "-")}
                    </span>,
                  )}
                </>
              }
            />
          }
          cleared={<EmptyState mark="Fin." title={t.projectDone} body={t.projectDoneBody(project?.name)} />}
          footer={project && (project.role === "owner" || project.role === "editor") ? <InlineAdd projectId={id} /> : undefined}
        />
      )}
    />
  );
}

function ProjectMenu({ id, name, color, count }: { id: string; name: string; color: Parameters<typeof projectDot>[0]; count: number }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const actions = useProjectActions();
  const router = useRouter();
  const tr = useT();
  const t = tr.views;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t.projectActions}>
            <Icon icon={MoreHorizontal} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem icon={<Icon icon={Pencil} />} onSelect={() => setEditing(true)}>
            {t.editProject}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" icon={<Icon icon={Trash2} />} onSelect={() => setDeleting(true)}>
            {t.deleteProject}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent title={t.editProjectTitle}>
          <ProjectForm
            initial={{ name, color: color as "ink" }}
            submitLabel={tr.common.save}
            onSubmit={(v) => {
              setEditing(false);
              void actions.update(id, v);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent
          title={t.deleteProjectTitle(name)}
          description={t.deleteProjectBody(count)}
        >
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{t.keepProject}</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={async () => {
                setDeleting(false);
                router.push("/inbox");
                await actions.remove(id);
              }}
            >
              {t.deleteForever}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------ Saved filter ------------------------------ */

export function FilterView({ id }: { id: string }) {
  const filters = useSavedFilters();
  const projects = useProjects().data ?? [];
  const saved = filters.data?.find((f) => f.id === id);
  const view = useMemo<View>(() => ({ kind: "all" }), []);
  const t = useT().views;
  const count = (n: number | null) => (n === null ? "" : t.taskCount(n));

  if (filters.isSuccess && !saved) return <EmptyState mark="?" title={t.filterMissing} body={t.filterMissingBody} />;
  if (!saved) return null;

  return (
    <ScopeView
      key={saved.id}
      title={saved.name}
      sub={(n) => [describeFilter(decodeFilter(saved.query), projects), count(n)].filter(Boolean).join(" · ")}
      actions={<FilterMenu id={saved.id} name={saved.name} query={saved.query} />}
      layouts={["list", "board", "calendar", "matrix"]}
      listView={view}
      boardGroupByProject
      savedFilter={{ id: saved.id, query: saved.query }}
      renderList={(tasks) => (
        <TaskList
          view={view}
          groups={[{ key: "all", tasks }]}
          empty={<EmptyState mark="∅" title={t.filterEmpty} body={t.filterEmptyBody} />}
        />
      )}
    />
  );
}

function FilterMenu({ id, name, query }: { id: string; name: string; query: string }) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);
  const { create, update, remove } = useFilterActions();
  const router = useRouter();
  const tr = useT();
  const t = tr.views;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t.filterActions}>
            <Icon icon={MoreHorizontal} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem icon={<Icon icon={Pencil} />} onSelect={() => setRenaming(true)}>
            {t.renameFilter}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            tone="danger"
            icon={<Icon icon={Trash2} />}
            onSelect={async () => {
              router.push("/today");
              if (await remove(id))
                toastWithUndo(t.deletedFilter(name), async () => {
                  const restored = await create({ id: crypto.randomUUID(), name, query });
                  if (restored) router.push(`/filter/${restored.id}`);
                });
            }}
          >
            {t.deleteFilter}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent title={t.renameFilterTitle}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!value.trim()) return;
              setRenaming(false);
              void update(id, { name: value.trim() });
            }}
          >
            <Field label={t.name}>{(p) => <Input {...p} autoFocus value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
            <Button type="submit" variant="primary" className="self-start">
              {tr.common.save}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
