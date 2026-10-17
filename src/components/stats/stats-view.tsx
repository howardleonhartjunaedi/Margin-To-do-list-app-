"use client";

import { Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { BarList, ColumnChart, DataTable, StatTile, type Datum } from "@/components/charts/charts";
import { ViewHeader } from "@/components/tasks/view-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { useStats } from "@/lib/data-productivity";
import { addDays, fromISODate } from "@/lib/dates";
import { minutesLabel } from "@/lib/focus";
import { weekStart } from "@/lib/habits";
import { projectDot } from "@/lib/project-colors";
import { activeStreak, deltaPct, fillDays } from "@/lib/stats";
import { useUrlParam } from "@/lib/view-transition";

type Range = "7" | "30" | "90" | "365";
const RANGE_LABEL: Record<Range, string> = { "7": "7 days", "30": "30 days", "90": "90 days", "365": "Year" };
const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const MON = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** Daily bars up to two months; weekly bars beyond, so marks never get thinner than useful. */
function series(from: string, to: string, values: Record<string, number>, today: string): Datum[] {
  const days = fillDays(from, to, values);
  if (days.length <= 62) {
    return days.map((d) => ({
      key: d.date,
      label: DAY.format(fromISODate(d.date)),
      short: String(fromISODate(d.date).getDate()),
      value: d.value,
      highlight: d.date === today,
    }));
  }
  const weeks = new Map<string, number>();
  for (const d of days) {
    const w = weekStart(d.date);
    weeks.set(w, (weeks.get(w) ?? 0) + d.value);
  }
  return [...weeks].map(([w, v]) => ({
    key: w,
    label: `Week of ${MON.format(fromISODate(w))}`,
    short: MON.format(fromISODate(w)).split(" ")[0],
    value: v,
    highlight: w === weekStart(today),
  }));
}

export function StatsView() {
  const { today } = useAppUI();
  const [range, setRange] = useUrlParam("range", "30");
  const r = (["7", "30", "90", "365"].includes(range) ? range : "30") as Range;
  const from = addDays(today, -(Number(r) - 1));
  const q = useStats(from, today);
  const s = q.data;

  const derived = useMemo(() => {
    if (!s) return null;
    const completed = Object.values(s.completedByDay).reduce((a, b) => a + b, 0);
    const focus = Object.values(s.focusMinutesByDay).reduce((a, b) => a + b, 0);
    const dated = s.onTime.onTime + s.onTime.late;
    return {
      completed,
      focus,
      onTimePct: dated ? Math.round((s.onTime.onTime / dated) * 100) : null,
      streak: activeStreak(new Set(s.activeDays), s.today),
      perDay: series(s.from, s.to, s.completedByDay, s.today),
      focusPerDay: series(s.from, s.to, s.focusMinutesByDay, s.today),
      hours: s.byHour.map((v, h) => ({ key: String(h), label: `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59`, short: String(h).padStart(2, "0"), value: v })),
    };
  }, [s]);

  return (
    <>
      <ViewHeader title="Stats" sub="What you finished, when, and where your focus went" />

      {/* One row of controls, above everything it scopes */}
      <div className="mb-8">
        <Segmented<Range>
          label="Date range"
          size="sm"
          value={r}
          onValueChange={(v) => setRange(v)}
          options={(Object.keys(RANGE_LABEL) as Range[]).map((k) => ({ value: k, label: RANGE_LABEL[k] }))}
        />
      </div>

      {q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : !s || !derived ? (
        <div className="grid gap-6 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
          <Skeleton className="h-48 sm:col-span-4" />
        </div>
      ) : derived.completed === 0 && derived.focus === 0 ? (
        <EmptyState
          mark="—"
          title={`Nothing finished in the last ${RANGE_LABEL[r].toLowerCase()} yet.`}
          body="Complete a few tasks or run a focus session, and your patterns will show up here."
        />
      ) : (
        <div className={cn("flex flex-col gap-12 transition-opacity duration-(--dur-base)", q.isPlaceholderData && "opacity-60")}>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <StatTile hero label="Tasks completed" value={derived.completed} delta={deltaPct(derived.completed, s.previous.completed)} />
            <StatTile label="Focus time" value={derived.focus} format={(v) => minutesLabel(Math.round(v))} delta={deltaPct(derived.focus, s.previous.focusMinutes)} />
            <StatTile label="Streak" value={derived.streak} format={(v) => `${Math.round(v)} ${Math.round(v) === 1 ? "day" : "days"}`} note="Days in a row with something done" />
            <StatTile
              label="On time"
              value={derived.onTimePct ?? 0}
              format={(v) => (derived.onTimePct === null ? "—" : `${Math.round(v)}%`)}
              note={derived.onTimePct === null ? "No dated tasks finished yet" : `${s.onTime.late} finished late`}
            />
          </div>

          <ChartSection title="Completed" sub={derived.perDay.length > 62 ? "Per week" : "Per day"} table={derived.perDay.map((d) => ({ label: d.label, value: String(d.value) }))} valueLabel="Tasks">
            <ColumnChart data={derived.perDay} format={(v) => `${v} ${v === 1 ? "task" : "tasks"}`} label="Tasks completed over time" />
          </ChartSection>

          <ChartSection title="Focus" sub="Minutes of focus sessions" table={derived.focusPerDay.map((d) => ({ label: d.label, value: minutesLabel(d.value) }))} valueLabel="Focus">
            <ColumnChart data={derived.focusPerDay} format={(v) => minutesLabel(v)} label="Focus minutes over time" />
          </ChartSection>

          <div className="grid gap-12 md:grid-cols-2">
            <ChartSection title="By project" table={s.byProject.map((p) => ({ label: p.name, value: String(p.n) }))} valueLabel="Tasks">
              <BarList
                rows={s.byProject.slice(0, 8).map((p) => ({ key: p.projectId ?? "inbox", label: p.name, dot: projectDot(p.color), value: p.n }))}
                format={(v) => String(v)}
              />
            </ChartSection>
            <ChartSection title="When you finish things" sub="By hour of day" table={derived.hours.map((h) => ({ label: h.label, value: String(h.value) }))} valueLabel="Tasks">
              <ColumnChart data={derived.hours} format={(v) => `${v} ${v === 1 ? "task" : "tasks"}`} height={150} label="Tasks completed by hour of day" />
            </ChartSection>
          </div>

          <p className="text-xs text-ink-3">
            {s.created} {s.created === 1 ? "task" : "tasks"} added in this period. Completions of repeating tasks each count once.
          </p>
        </div>
      )}
    </>
  );
}

function ChartSection({
  title,
  sub,
  table,
  valueLabel,
  children,
}: {
  title: string;
  sub?: string;
  table: { label: string; value: string }[];
  valueLabel: string;
  children: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section aria-label={title} className="border-t border-line pt-4">
      <header className="mb-4 flex items-baseline gap-3">
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {sub && <span className="text-xs text-ink-3">{sub}</span>}
        <Button variant="ghost" size="sm" className="ml-auto" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          <Icon icon={Table2} size="xs" /> {asTable ? "Chart" : "Table"}
        </Button>
      </header>
      {asTable ? <DataTable caption={title} rows={table} valueLabel={valueLabel} /> : children}
    </section>
  );
}
