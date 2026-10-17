"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { ProjectForm } from "@/components/app/project-form";
import { ScopeView } from "@/components/views/scope";
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
import { addDays, dayHeading, fromISODate } from "@/lib/dates";
import { describeFilter, decodeFilter } from "@/lib/filters";
import { projectDot } from "@/lib/project-colors";
import { cn } from "@/lib/cn";
import type { Task, View } from "@/lib/types";
import { InlineAdd } from "./inline-add";
import { TaskList, type TaskGroup } from "./task-list";

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const count = (n: number | null) => (n === null ? "" : plural(n, "task"));

/* ------------------------------ Today ------------------------------ */

export function TodayView() {
  const { today } = useAppUI();
  const view = useMemo<View>(() => ({ kind: "today", today }), [today]);
  const actions = useTaskActions();

  return (
    <ScopeView
      title="Today"
      sub={(n) => [LONG_DATE.format(fromISODate(today)), count(n)].filter(Boolean).join(" · ")}
      layouts={["list", "board", "matrix"]}
      listView={view}
      boardGroupByProject
      renderList={(tasks) => {
        const overdue = tasks.filter((t) => t.dueDate! < today);
        const due = tasks.filter((t) => t.dueDate === today);
        const moveAll = () => {
          const moved = overdue.filter((t) => !t.completedAt);
          moved.forEach((t) => void actions.update(t, { dueDate: today }));
          toastWithUndo(`Moved ${plural(moved.length, "task")} to today.`, () =>
            moved.forEach((t) => void actions.update({ ...t, dueDate: today }, { dueDate: t.dueDate })),
          );
        };
        const groups: TaskGroup[] = [
          {
            key: "overdue",
            title: "Overdue",
            tone: "danger",
            action: (
              <Button size="sm" variant="ghost" onClick={moveAll}>
                Move all to today
              </Button>
            ),
            tasks: overdue,
          },
          { key: "today", title: overdue.some((t) => !t.completedAt) ? "Today" : undefined, hideDate: true, tasks: due },
        ];
        return (
          <TaskList
            view={view}
            groups={groups}
            empty={
              <EmptyState
                mark="*"
                title="Nothing due today."
                body={
                  <>
                    A quiet day, or a blank page. Press <Kbd>Q</Kbd> to add something, or pull a task forward from Upcoming.
                  </>
                }
              />
            }
            cleared={<EmptyState mark="Fin." title="Today is clear." body="That’s everything that was due. Tomorrow can wait until tomorrow." />}
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
  return (
    <ScopeView
      title="Inbox"
      sub={count}
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
              title="Inbox is empty."
              body={
                <>
                  Press <Kbd>Q</Kbd> anywhere to capture a task. It waits here until you give it a day or a project.
                </>
              }
            />
          }
          cleared={<EmptyState mark="Fin." title="Inbox zero." body="Everything you captured has a home." />}
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

  return (
    <ScopeView
      title="Upcoming"
      sub={(n) => (n === null ? "" : `Through ${LONG_DATE.format(fromISODate(through))} · ${count(n)}`)}
      layouts={["list", "calendar", "timeline", "board"]}
      listView={view}
      boardGroupByProject
      renderList={(tasks) => {
        const overdue = tasks.filter((t) => t.dueDate! < today);
        const byDay = new Map<string, Task[]>();
        for (const t of tasks) if (t.dueDate! >= today) byDay.set(t.dueDate!, [...(byDay.get(t.dueDate!) ?? []), t]);
        const groups: TaskGroup[] = [
          { key: "overdue", title: "Overdue", tone: "danger", tasks: overdue },
          ...[...byDay].map(([date, list]) => {
            const h = dayHeading(date, today);
            return { key: date, title: h.title, sub: h.sub, hideDate: true, tasks: list };
          }),
        ];
        return (
          <TaskList
            view={view}
            groups={groups}
            empty={<EmptyState mark="→" title={`Nothing scheduled in the next ${weeks} weeks.`} body="Tasks with a date show up here, grouped by day." />}
            footer={
              <Button variant="ghost" className="self-start" onClick={() => setWeeks((w) => w + WEEKS)}>
                Show the following {WEEKS} weeks
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

  if (projects.isSuccess && !project) {
    return <EmptyState mark="?" title="That project doesn’t exist." body="It may have been deleted. Your other projects are in the sidebar." />;
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
      actions={project && <ProjectMenu id={project.id} name={project.name} color={project.color} count={project.openCount} />}
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
              title={`No open tasks in ${project?.name ?? "this project"}.`}
              body={
                <>
                  Add one below, or type <span className="font-mono text-xs">#{project?.name.toLowerCase().replace(/\s+/g, "-")}</span> in quick
                  add from anywhere.
                </>
              }
            />
          }
          cleared={<EmptyState mark="Fin." title="All done here." body={`Nothing left open in ${project?.name}.`} />}
          footer={<InlineAdd projectId={id} />}
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
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Project actions">
            <Icon icon={MoreHorizontal} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem icon={<Icon icon={Pencil} />} onSelect={() => setEditing(true)}>
            Edit project…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" icon={<Icon icon={Trash2} />} onSelect={() => setDeleting(true)}>
            Delete project…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent title="Edit project">
          <ProjectForm
            initial={{ name, color: color as "ink" }}
            submitLabel="Save"
            onSubmit={(v) => {
              setEditing(false);
              void actions.update(id, v);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent
          title={`Delete “${name}”?`}
          description={`${count ? `Its ${plural(count, "open task")} go with it. ` : ""}This can’t be undone.`}
        >
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Keep project</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={async () => {
                setDeleting(false);
                router.push("/inbox");
                await actions.remove(id);
              }}
            >
              Delete forever
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

  if (filters.isSuccess && !saved)
    return <EmptyState mark="?" title="That filter doesn’t exist." body="It may have been deleted. Your other filters are in the sidebar." />;
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
          empty={<EmptyState mark="∅" title="Nothing matches right now." body="Tasks appear here as soon as they fit the filter." />}
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
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Filter actions">
            <Icon icon={MoreHorizontal} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem icon={<Icon icon={Pencil} />} onSelect={() => setRenaming(true)}>
            Rename…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            tone="danger"
            icon={<Icon icon={Trash2} />}
            onSelect={async () => {
              router.push("/today");
              if (await remove(id))
                toastWithUndo(`Deleted the “${name}” filter.`, async () => {
                  const restored = await create({ id: crypto.randomUUID(), name, query });
                  if (restored) router.push(`/filter/${restored.id}`);
                });
            }}
          >
            Delete filter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent title="Rename filter">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!value.trim()) return;
              setRenaming(false);
              void update(id, { name: value.trim() });
            }}
          >
            <Field label="Name">{(p) => <Input {...p} autoFocus value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
            <Button type="submit" variant="primary" className="self-start">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
