"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { ProjectForm } from "@/components/app/project-form";
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
import { EmptyState, ErrorState, TaskRowSkeleton } from "@/components/ui/states";
import { toastWithUndo } from "@/components/ui/toast";
import { useProjectActions, useProjects, useTaskActions, useTasks } from "@/lib/data";
import { addDays, dayHeading, fromISODate } from "@/lib/dates";
import { projectDot } from "@/lib/project-colors";
import { cn } from "@/lib/cn";
import type { Task, View } from "@/lib/types";
import { InlineAdd } from "./inline-add";
import { TaskList, type TaskGroup } from "./task-list";
import { ViewHeader } from "./view-header";

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

function Loadable({ view, children }: { view: View; children: (tasks: Task[]) => React.ReactNode }) {
  const q = useTasks(view);
  if (q.isPending) return <TaskRowSkeleton rows={5} />;
  if (q.isError) return <ErrorState message={`${q.error.message} Your tasks are safe — we just can’t reach them right now.`} onRetry={() => q.refetch()} />;
  return <>{children(q.data)}</>;
}

const openCount = (tasks: Task[]) => tasks.filter((t) => !t.completedAt).length;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/* ------------------------------ Today ------------------------------ */

export function TodayView() {
  const { today } = useAppUI();
  const view = useMemo<View>(() => ({ kind: "today", today }), [today]);
  const actions = useTaskActions();

  return (
    <>
      <Loadable view={view}>
        {(tasks) => {
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
            <>
              <ViewHeader title="Today" sub={`${LONG_DATE.format(fromISODate(today))} · ${plural(openCount(tasks), "task")}`} />
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
            </>
          );
        }}
      </Loadable>
    </>
  );
}

/* ------------------------------ Inbox ------------------------------ */

export function InboxView() {
  const view = useMemo<View>(() => ({ kind: "inbox" }), []);
  return (
    <Loadable view={view}>
      {(tasks) => (
        <>
          <ViewHeader title="Inbox" sub={plural(openCount(tasks), "task")} />
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
        </>
      )}
    </Loadable>
  );
}

/* ------------------------------ Upcoming ------------------------------ */

const WEEKS = 4;

export function UpcomingView() {
  const { today } = useAppUI();
  const [weeks, setWeeks] = useState(WEEKS);
  const view = useMemo<View>(() => ({ kind: "upcoming", today, to: addDays(today, weeks * 7) }), [today, weeks]);

  return (
    <Loadable view={view}>
      {(tasks) => {
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
        const to = addDays(today, weeks * 7 - 1);
        return (
          <>
            <ViewHeader title="Upcoming" sub={`Through ${LONG_DATE.format(fromISODate(to))}`} />
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
          </>
        );
      }}
    </Loadable>
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
    <Loadable view={view}>
      {(tasks) => (
        <>
          <ViewHeader
            title={
              <span className="inline-flex items-center gap-3">
                {project && <span className={cn("size-3 rounded-full", projectDot(project.color))} aria-hidden />}
                {project?.name ?? " "}
              </span>
            }
            sub={plural(openCount(tasks), "task")}
            actions={project && <ProjectMenu id={project.id} name={project.name} color={project.color} count={tasks.length} />}
          />
          <TaskList
            view={view}
            groups={[{ key: "all", tasks }]}
            empty={
              <EmptyState
                mark="§"
                title={`No open tasks in ${project?.name ?? "this project"}.`}
                body={
                  <>
                    Add one below, or type <span className="font-mono text-xs">#{project?.name.toLowerCase().replace(/\s+/g, "-")}</span> in
                    quick add from anywhere.
                  </>
                }
              />
            }
            cleared={<EmptyState mark="Fin." title="All done here." body={`Nothing left open in ${project?.name}.`} />}
            footer={<InlineAdd projectId={id} />}
          />
        </>
      )}
    </Loadable>
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
          <Button variant="ghost" size="icon" aria-label="Project actions">
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
