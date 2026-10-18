"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Archive, ChevronDown, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { ViewHeader } from "@/components/tasks/view-header";
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
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { duration, ease, spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { useHabitActions, useHabits } from "@/lib/data-productivity";
import { addDays, formatDue, formatDate, fromISODate } from "@/lib/dates";
import { checksThisWeek, describeTarget, keptRate, streak, weekStart } from "@/lib/habits";
import { PROJECT_COLORS, projectDot } from "@/lib/project-colors";
import type { Habit, ProjectColor } from "@/lib/types";
import { m } from "@/i18n/catalogs";
import { useT } from "@/i18n/client";

const FILL: Record<ProjectColor, string> = {
  ink: "bg-ink-2",
  accent: "bg-accent",
  p1: "bg-p1",
  p2: "bg-p2",
  p3: "bg-p3",
  success: "bg-success",
};

export function HabitsView() {
  const { today } = useAppUI();
  const q = useHabits();
  const [adding, setAdding] = useState(false);
  const habits = q.data ?? [];
  const keptToday = habits.filter((h) => h.checks.includes(today)).length;
  const tr = useT();
  const t = tr.habits;

  return (
    <>
      <ViewHeader
        title={tr.nav.habits}
        sub={habits.length ? t.sub(keptToday, habits.length) : undefined}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Icon icon={Plus} /> {t.newHabit}
          </Button>
        }
      />
      <HabitDialog open={adding} onOpenChange={setAdding} />

      {q.isPending ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : habits.length === 0 ? (
        <EmptyState
          mark="↻"
          title={t.empty}
          body={t.emptyBody}
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              {t.addFirst}
            </Button>
          }
        />
      ) : (
        <>
          <WeekHeader today={today} />
          <ul className="divide-y divide-line border-y border-line">
            <AnimatePresence initial={false}>
              {habits.map((h) => (
                <HabitRow key={h.id} habit={h} today={today} />
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}
    </>
  );
}

const lastDays = (today: string, n = 7) => Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));

function WeekHeader({ today }: { today: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-4 pb-2 sm:grid-cols-[1fr_auto_7rem]">
      <span />
      <div className="flex gap-1">
        {lastDays(today).map((d) => (
          <span key={d} className={cn("w-8 text-center font-mono text-2xs", d === today ? "text-accent" : "text-ink-3")}>
            {formatDate(d, { weekday: "narrow" })}
            <span className="block">{Number(d.slice(8))}</span>
          </span>
        ))}
      </div>
      <span className="hidden sm:block" />
    </div>
  );
}

function HabitRow({ habit, today }: { habit: Habit; today: string }) {
  const actions = useHabitActions();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const checks = useMemo(() => new Set(habit.checks), [habit.checks]);
  const s = streak(checks, habit.targetPerWeek, today);
  const rate = keptRate(checks, habit.targetPerWeek, today, habit.createdOn);
  const week = checksThisWeek(checks, today);
  const t = useT().habits;

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: duration.base, ease: ease.exit } }}
      transition={spring.pop}
      className="group py-3"
    >
      <div className="grid grid-cols-[1fr_auto] items-center gap-4 sm:grid-cols-[1fr_auto_7rem]">
        <div className="min-w-0">
          <button onClick={() => setOpen((o) => !o)} className="flex max-w-full items-center gap-2 text-left" aria-expanded={open}>
            <span className={cn("size-2 shrink-0 rounded-full", projectDot(habit.color))} />
            <span className="truncate text-base text-ink sm:text-sm">{habit.name}</span>
            <Icon icon={ChevronDown} size="xs" className={cn("shrink-0 text-ink-3 transition-transform duration-(--dur-base)", open && "rotate-180")} />
          </button>
          <p className="mt-0.5 pl-4 font-mono text-2xs text-ink-3">
            {describeTarget(habit.targetPerWeek)}
            {habit.targetPerWeek < 7 && t.thisWeek(week, habit.targetPerWeek)}
            <span className="sm:hidden"> · {t.streak(s.count, s.unit)}</span>
          </p>
        </div>
        <div className="flex gap-1">
          {lastDays(today).map((d) => (
            <DayCheck key={d} habit={habit} date={d} today={today} done={checks.has(d)} onToggle={() => void actions.toggle(habit, d)} />
          ))}
        </div>
        <div className="hidden items-center justify-end gap-1 sm:flex">
          <div className="text-right">
            <p className="font-mono text-xs text-ink" title={t.currentStreak}>
              {t.streak(s.count, s.unit)}
            </p>
            <p className="font-mono text-2xs text-ink-3" title={t.keptRecently}>
              {rate === null ? t.isNew : t.kept(Math.round(rate * 100))}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t.actionsFor(habit.name)} className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                <Icon icon={MoreHorizontal} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem icon={<Icon icon={Pencil} />} onSelect={() => setEditing(true)}>
                {t.editMenu}
              </DropdownMenuItem>
              <DropdownMenuItem icon={<Icon icon={Archive} />} onSelect={() => void actions.archive(habit)}>
                {t.archive}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" icon={<Icon icon={Trash2} />} onSelect={() => setDeleting(true)}>
                {t.deleteMenu}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.base, ease: ease.enter }}
            className="mt-4 pl-4"
          >
            <Heatmap habit={habit} checks={checks} today={today} />
            <div className="mt-3 flex gap-2 sm:hidden">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                {t.edit}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void actions.archive(habit)}>
                {t.archive}
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(true)}>
                {t.delete}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <HabitDialog open={editing} onOpenChange={setEditing} habit={habit} />
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent title={t.deleteTitle(habit.name)} description={t.deleteBody}>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{t.keep}</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button onClick={() => void actions.archive(habit)}>
                <Icon icon={Archive} /> {t.archive}
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="danger" onClick={() => void actions.remove(habit)}>
                {t.deleteForever}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.li>
  );
}

function DayCheck({ habit, date, today, done, onToggle }: { habit: Habit; date: string; today: string; done: boolean; onToggle: () => void }) {
  const before = date < habit.createdOn;
  return (
    <CheckboxPrimitive.Root
      checked={done}
      onCheckedChange={onToggle}
      aria-label={`${habit.name}, ${formatDue(date, today)}`}
      className={cn(
        "relative grid size-8 place-items-center rounded-full ring-[1.5px] ring-inset transition-[background-color,box-shadow,transform] duration-(--dur-fast) active:scale-90",
        "before:absolute before:-inset-1 before:content-['']",
        done ? cn(FILL[habit.color], "ring-transparent") : before ? "ring-line" : "ring-control hover:ring-ink-3",
        date === today && !done && "ring-ink-2",
      )}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="text-bg">
        <motion.path
          d="M2.25 6.4 4.9 9 9.75 3.25"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
          transition={{ pathLength: { duration: duration.base, ease: ease.enter }, opacity: { duration: duration.fast } }}
        />
      </svg>
    </CheckboxPrimitive.Root>
  );
}

const WEEKS = 26;

/** Half a year of days, one column per week (Mon→Sun). One hue: kept vs not. */
function Heatmap({ habit, checks, today }: { habit: Habit; checks: Set<string>; today: string }) {
  const start = addDays(weekStart(today), -(WEEKS - 1) * 7);
  const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const total = habit.checks.filter((d) => d >= start).length;
  const t = useT().habits;
  return (
    <figure>
      <div className="overflow-x-auto" data-lenis-prevent>
        <div className="flex gap-[3px]" role="img" aria-label={t.heatmap(habit.name, total)}>
          {weeks.map((days, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {days.map((d) => (
                <span
                  key={d}
                  title={`${formatDue(d, today)}${checks.has(d) ? t.doneSuffix : ""}`}
                  className={cn(
                    "size-2.5",
                    d > today ? "bg-transparent" : checks.has(d) ? FILL[habit.color] : d < habit.createdOn ? "bg-sunken/50" : "bg-sunken",
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 font-mono text-2xs text-ink-3">
        {t.daysIn6Months(total)}
      </figcaption>
    </figure>
  );
}

function HabitDialog({ open, onOpenChange, habit }: { open: boolean; onOpenChange: (o: boolean) => void; habit?: Habit }) {
  const actions = useHabitActions();
  const [name, setName] = useState(habit?.name ?? "");
  const [target, setTarget] = useState(habit?.targetPerWeek ?? 7);
  const [color, setColor] = useState<ProjectColor>(habit?.color ?? "success");
  const [error, setError] = useState<string>();
  const tr = useT();
  const t = tr.habits;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={habit ? t.editHabit : t.newHabit}>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return setError(t.needsName);
            onOpenChange(false);
            if (habit) void actions.update(habit.id, { name: name.trim(), targetPerWeek: target, color });
            else {
              void actions.create({ name: name.trim(), targetPerWeek: target, color });
              setName("");
            }
          }}
        >
          <Field label={t.name} error={error}>
            {(p) => <Input {...p} autoFocus value={name} placeholder={t.placeholder} onChange={(e) => (setName(e.target.value), setError(undefined))} />}
          </Field>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            {t.howOften}
            <select
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="h-10 rounded-md bg-raised px-3 text-sm font-normal text-ink ring-1 ring-control ring-inset"
            >
              <option value={7}>{t.everyDay}</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {t.perWeek(n)}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t.color}</legend>
            <div className="flex gap-1.5">
              {PROJECT_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  aria-label={tr.projectForm.colors[c.value]}
                  aria-pressed={color === c.value}
                  onClick={() => setColor(c.value)}
                  className={cn("grid size-8 place-items-center rounded-md ring-1 ring-line ring-inset", color === c.value && "ring-2 ring-ink")}
                >
                  <span className={cn("size-3 rounded-full", c.dot)} />
                </button>
              ))}
            </div>
          </fieldset>
          <Button type="submit" variant="primary" className="self-start">
            {habit ? t.save : t.add}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Today's habits as a strip of toggles (shown on the Today page). */
export function TodayHabits() {
  const { today } = useAppUI();
  const habits = useHabits().data ?? [];
  const actions = useHabitActions();
  const t = useT().habits;
  if (!habits.length) return null;
  return (
    <section aria-label={t.todayStrip} className="mb-8 flex flex-wrap items-center gap-2">
      {habits.map((h) => {
        const done = h.checks.includes(today);
        return (
          <button
            key={h.id}
            role="checkbox"
            aria-checked={done}
            onClick={() => void actions.toggle(h, today)}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-full pr-3 pl-1 text-sm transition-colors duration-(--dur-fast) active:scale-[0.97]",
              done ? "bg-sunken text-ink-3" : "bg-raised text-ink ring-1 ring-line ring-inset hover:ring-line-strong",
            )}
          >
            <span className={cn("grid size-6 place-items-center rounded-full ring-[1.5px] ring-inset", done ? cn(FILL[h.color], "ring-transparent") : "ring-control")}>
              {done && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden className="text-bg">
                  <motion.path d="M2.25 6.4 4.9 9 9.75 3.25" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: duration.base, ease: ease.enter }} />
                </svg>
              )}
            </span>
            <span className={cn(done && "line-through decoration-ink-3/60")}>{h.name}</span>
          </button>
        );
      })}
    </section>
  );
}
