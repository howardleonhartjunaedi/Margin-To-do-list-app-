"use client";

import { ArrowRight, Check, Plus, Sunrise, Moon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { CountUp } from "@/components/charts/charts";
import { quickDates } from "@/components/tasks/reschedule";
import { ViewHeader } from "@/components/tasks/view-header";
import { Button } from "@/components/ui/button";
import { TaskCheckbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/states";
import { duration, ease, spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { truncate, useProjects, useTaskActions, useTasks } from "@/lib/data";
import { useDay, useSaveDay, useStats } from "@/lib/data-productivity";
import { addDays, formatDue, fromISODate } from "@/lib/dates";
import { minutesLabel } from "@/lib/focus";
import { projectDot } from "@/lib/project-colors";
import type { Task, View } from "@/lib/types";

const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const exitRow = { opacity: 0, x: 24, transition: { duration: duration.base, ease: ease.exit } };

function Step({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-6 border-t border-line pt-5 pb-10 sm:grid-cols-[2rem_1fr]" aria-labelledby={`step-${n}`}>
      <span className="font-mono text-xs text-accent">{String(n).padStart(2, "0")}</span>
      <div className="min-w-0">
        <h2 id={`step-${n}`} className="font-display text-xl text-ink">
          {title}
        </h2>
        {sub && <p className="mt-1 mb-4 text-sm text-ink-2">{sub}</p>}
        {children}
      </div>
    </section>
  );
}

function Row({ t, children, project }: { t: Task; children: React.ReactNode; project?: { name: string; color: string } }) {
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={exitRow} transition={spring.pop} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{t.title}</p>
        <p className="flex items-center gap-2 font-mono text-2xs text-ink-3">
          {project && (
            <span className="inline-flex items-center gap-1 font-sans text-xs">
              <span className={cn("size-1.5 rounded-full", projectDot(project.color))} />
              {project.name}
            </span>
          )}
          {t.estimateMinutes && <span>~{minutesLabel(t.estimateMinutes)}</span>}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </motion.li>
  );
}

/* ------------------------------ Morning ------------------------------ */

export function PlanView() {
  const { today } = useAppUI();
  const router = useRouter();
  const actions = useTaskActions();
  const projects = useProjects().data ?? [];
  const pOf = (t: Task) => projects.find((p) => p.id === t.projectId);
  const day = useDay(today);
  const save = useSaveDay(today);

  const todayView = useMemo<View>(() => ({ kind: "today", today }), [today]);
  const inboxView = useMemo<View>(() => ({ kind: "inbox" }), []);
  const soonView = useMemo<View>(() => ({ kind: "upcoming", today, to: addDays(today, 8) }), [today]);
  const todays = (useTasks(todayView).data ?? []).filter((t) => !t.completedAt);
  const inbox = (useTasks(inboxView).data ?? []).filter((t) => !t.completedAt && !t.dueDate);
  const soon = (useTasks(soonView).data ?? []).filter((t) => !t.completedAt && t.dueDate! > today);
  const overdue = todays.filter((t) => t.dueDate! < today);
  const planned = todays.filter((t) => t.dueDate === today);

  const [intention, setIntention] = useState("");
  const [capacity, setCapacity] = useState<number | null>(null);
  useEffect(() => {
    if (day.data) {
      setIntention(day.data.intention);
      setCapacity(day.data.capacityMinutes);
    }
  }, [day.data]);

  const q = quickDates(today);
  const tomorrow = q[1];
  const nextWeek = q[3];
  const move = (t: Task, c: { date: string | null; label: string }) => void actions.reschedule(t, c.date, c.label.toLowerCase());
  const estimated = planned.reduce((n, t) => n + (t.estimateMinutes ?? 0), 0);
  const unestimated = planned.filter((t) => !t.estimateMinutes).length;
  const load = capacity ? estimated / capacity : 0;

  return (
    <>
      <ViewHeader title="Plan your day" sub={LONG.format(fromISODate(today))} />

      {overdue.length > 0 && (
        <Step n={1} title="Yesterday’s leftovers" sub="Decide where each one goes. Nothing is lost by moving it.">
          <ul>
            <AnimatePresence initial={false}>
              {overdue.map((t) => (
                <Row key={t.id} t={t} project={pOf(t)}>
                  <Button size="sm" variant="secondary" onClick={() => move(t, { date: today, label: "today" })}>
                    Today
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => move(t, tomorrow)}>
                    Tomorrow
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => move(t, nextWeek)}>
                    Next week
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => move(t, { date: null, label: "no date" })}>
                    Someday
                  </Button>
                </Row>
              ))}
            </AnimatePresence>
          </ul>
        </Step>
      )}

      <Step n={overdue.length ? 2 : 1} title="Pick what matters today" sub="From your Inbox and the next few days. Today has what’s already due.">
        <ul>
          <AnimatePresence initial={false}>
            {[...inbox.slice(0, 6), ...soon.slice(0, 6)].map((t) => (
              <Row key={t.id} t={t} project={pOf(t)}>
                {t.dueDate && <span className="self-center font-mono text-2xs text-ink-3">{formatDue(t.dueDate, today)}</span>}
                <Button size="sm" variant="secondary" onClick={() => move(t, { date: today, label: "today" })}>
                  <Icon icon={Plus} size="xs" /> Today
                </Button>
              </Row>
            ))}
          </AnimatePresence>
          {!inbox.length && !soon.length && <li className="py-3 text-sm text-ink-3">Nothing waiting. Your Inbox is clear and the next week is quiet.</li>}
        </ul>
      </Step>

      <Step n={overdue.length ? 3 : 2} title="How much time do you have?" sub="For tasks, not meetings. Add estimates with ~30m in quick add.">
        <div className="flex flex-wrap gap-1.5">
          {[120, 240, 360, 480].map((m) => (
            <button
              key={m}
              aria-pressed={capacity === m}
              onClick={() => setCapacity(m)}
              className={cn("h-8 rounded-sm px-3 text-sm transition-colors duration-(--dur-fast)", capacity === m ? "bg-ink text-bg" : "bg-sunken text-ink-2 hover:text-ink")}
            >
              {m / 60} hours
            </button>
          ))}
        </div>
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-sm bg-sunken" role="meter" aria-valuemin={0} aria-valuemax={capacity ?? 0} aria-valuenow={estimated} aria-label="Planned time">
            <motion.div
              className={cn("h-full origin-left rounded-sm", load > 1.1 ? "bg-danger" : load > 0.9 ? "bg-warning" : "bg-accent")}
              initial={false}
              animate={{ scaleX: capacity ? Math.min(1, load) : 0 }}
              transition={spring.layout}
            />
          </div>
          <p className="mt-2 text-sm text-ink-2">
            {planned.length} {planned.length === 1 ? "task" : "tasks"} for today
            {estimated > 0 && <> · {minutesLabel(estimated)} estimated</>}
            {capacity && <> of {minutesLabel(capacity)}</>}
            {unestimated > 0 && <span className="text-ink-3"> · {unestimated} without an estimate</span>}
          </p>
          {load > 1.1 && <p className="mt-1 text-sm text-danger">That’s more than the time you have. Move something to tomorrow?</p>}
        </div>
      </Step>

      <Step n={overdue.length ? 4 : 3} title="One thing that would make today good">
        <Input value={intention} onChange={(e) => setIntention(e.target.value)} placeholder="Ship the budget draft before lunch" aria-label="Today’s intention" maxLength={200} />
        <div className="mt-6">
          <Button
            variant="primary"
            size="lg"
            magnetic
            onClick={async () => {
              await save({ intention: intention.trim(), capacityMinutes: capacity, planned: true });
              router.push("/today");
            }}
          >
            Start the day <Icon icon={ArrowRight} />
          </Button>
        </div>
      </Step>
    </>
  );
}

/* ------------------------------ Evening ------------------------------ */

export function ReviewView() {
  const { today } = useAppUI();
  const actions = useTaskActions();
  const day = useDay(today);
  const save = useSaveDay(today);
  const stats = useStats(today, today).data;
  const todayView = useMemo<View>(() => ({ kind: "today", today }), [today]);
  const open = (useTasks(todayView).data ?? []).filter((t) => !t.completedAt);
  const [reflection, setReflection] = useState("");
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (day.data) setReflection(day.data.reflection);
  }, [day.data]);
  const q = quickDates(today);
  const done = day.data?.completed ?? [];
  const focus = stats?.focusMinutesByDay[today] ?? 0;

  if (closed)
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.slow, ease: ease.enter }} className="py-16">
        <p className="font-display text-4xl text-ink">That’s the day.</p>
        <p className="mt-3 text-base text-ink-2">Rest well. Tomorrow’s list is ready when you are.</p>
        <Button asChild variant="ghost" className="mt-6">
          <Link href="/upcoming">Look at tomorrow</Link>
        </Button>
      </motion.div>
    );

  return (
    <>
      <ViewHeader title="Review your day" sub={LONG.format(fromISODate(today))} />

      <Step n={1} title="What got done">
        {day.isPending ? (
          <Skeleton className="h-20" />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <p className="font-sans text-5xl font-semibold tracking-tight text-ink">
                  <CountUp value={done.length} />
                </p>
                <p className="text-xs text-ink-2">{done.length === 1 ? "task" : "tasks"} completed</p>
              </div>
              {focus > 0 && (
                <div>
                  <p className="font-sans text-3xl font-semibold tracking-tight text-ink">{minutesLabel(focus)}</p>
                  <p className="text-xs text-ink-2">focused</p>
                </div>
              )}
            </div>
            {day.data?.intention && (
              <p className="mt-5 text-sm text-ink-2">
                This morning you said: <span className="font-display text-base text-ink italic">“{day.data.intention}”</span>
              </p>
            )}
            {done.length > 0 && (
              <ul className="mt-5 flex flex-col gap-1.5">
                {done.map((t) => (
                  <li key={t.id + t.completedAt} className="flex items-center gap-2 text-sm text-ink-2">
                    <Icon icon={Check} size="xs" className="text-success" />
                    <span className="line-through decoration-ink-3/50">{t.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Step>

      <Step n={2} title="Still open" sub={open.length ? "Give each one a next step." : undefined}>
        <ul>
          <AnimatePresence initial={false}>
            {open.map((t) => (
              <Row key={t.id} t={t}>
                <span className="mr-1 self-center">
                  <TaskCheckbox checked={false} priority={t.priority} onCheckedChange={() => void actions.complete(t)} aria-label={`Complete: ${t.title}`} />
                </span>
                <Button size="sm" variant="secondary" onClick={() => void actions.reschedule(t, q[1].date, "tomorrow")}>
                  Tomorrow
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void actions.reschedule(t, q[3].date, "next week")}>
                  Next week
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void actions.reschedule(t, null, "no date")}>
                  Someday
                </Button>
              </Row>
            ))}
          </AnimatePresence>
          {!open.length && <li className="py-3 text-sm text-ink-3">Nothing left over. A clean finish.</li>}
        </ul>
      </Step>

      <Step n={3} title="A line for future you" sub="What went well? What got in the way? Only you see this.">
        <Textarea value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="The morning block worked. Meetings ate the afternoon." aria-label="Reflection" />
        <div className="mt-6">
          <Button
            variant="primary"
            size="lg"
            magnetic
            onClick={async () => {
              const saved = await save({ reflection: reflection.trim(), reviewed: true });
              if (saved) setClosed(true);
            }}
          >
            Close the day <Icon icon={Moon} />
          </Button>
        </div>
      </Step>
    </>
  );
}

/* ------------------------------ Today header ------------------------------ */

/** Morning: offer planning. Evening: offer review. Shows today's intention once set. */
export function DayPrompt() {
  const { today } = useAppUI();
  const day = useDay(today).data;
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);
  if (!day || hour === null) return null;
  const showPlan = !day.plannedAt && hour < 14;
  const showReview = !day.reviewedAt && hour >= 16;
  if (!day.intention && !showPlan && !showReview) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      {day.intention && (
        <p className="min-w-0 flex-1 text-sm text-ink-2">
          Today: <span className="font-display text-base text-ink italic">{truncate(day.intention, 90)}</span>
        </p>
      )}
      {showPlan && (
        <Button asChild size="sm" variant="secondary">
          <Link href="/plan">
            <Icon icon={Sunrise} /> Plan your day
          </Link>
        </Button>
      )}
      {showReview && (
        <Button asChild size="sm" variant="secondary">
          <Link href="/review">
            <Icon icon={Moon} /> Review your day
          </Link>
        </Button>
      )}
    </div>
  );
}
