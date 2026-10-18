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
import { addDays, formatDate, fromISODate } from "@/lib/dates";
import { minutesLabel } from "@/lib/focus";
import { weekStart } from "@/lib/habits";
import { projectDot } from "@/lib/project-colors";
import { activeStreak, deltaPct, fillDays } from "@/lib/stats";
import { useUrlParam } from "@/lib/view-transition";
import { useT } from "@/i18n/client";
import { m } from "@/i18n/catalogs";

type Range = "7" | "30" | "90" | "365";
const RANGES: Range[] = ["7", "30", "90", "365"];
const DAY: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
const MON: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/** Daily bars up to two months; weekly bars beyond, so marks never get thinner than useful. */
function series(from: string, to: string, values: Record<string, number>, today: string): Datum[] {
  const days = fillDays(from, to, values);
  if (days.length <= 62) {
    return days.map((d) => ({
      key: d.date,
      label: formatDate(d.date, DAY),
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
    label: m().stats.weekOf(formatDate(w, MON)),
    short: formatDate(w, { day: "numeric" }),
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
  const tr = useT();
  const t = tr.stats;

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
      <ViewHeader title={tr.nav.stats} sub={t.sub} />

      {/* One row of controls, above everything it scopes */}
      <div className="mb-8">
        <Segmented<Range>
          label={t.dateRange}
          size="sm"
          value={r}
          onValueChange={(v) => setRange(v)}
          options={RANGES.map((k) => ({ value: k, label: t.ranges[k] }))}
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
          title={t.empty(t.ranges[r])}
          body={t.emptyBody}
        />
      ) : (
        <div className={cn("flex flex-col gap-12 transition-opacity duration-(--dur-base)", q.isPlaceholderData && "opacity-60")}>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <StatTile hero label={t.tasksCompleted} value={derived.completed} delta={deltaPct(derived.completed, s.previous.completed)} />
            <StatTile label={t.focusTime} value={derived.focus} format={(v) => minutesLabel(Math.round(v))} delta={deltaPct(derived.focus, s.previous.focusMinutes)} />
            <StatTile label={t.streak} value={derived.streak} format={(v) => t.days(Math.round(v))} note={t.streakNote} />
            <StatTile
              label={t.onTime}
              value={derived.onTimePct ?? 0}
              format={(v) => (derived.onTimePct === null ? "—" : `${Math.round(v)}%`)}
              note={derived.onTimePct === null ? t.noDated : t.late(s.onTime.late)}
            />
          </div>

          <ChartSection title={t.completed} sub={derived.perDay.length > 62 ? t.perWeek : t.perDay} table={derived.perDay.map((d) => ({ label: d.label, value: String(d.value) }))} valueLabel={t.tasks}>
            <ColumnChart data={derived.perDay} format={t.taskCount} label={t.completedOverTime} />
          </ChartSection>

          <ChartSection title={t.focus} sub={t.focusSub} table={derived.focusPerDay.map((d) => ({ label: d.label, value: minutesLabel(d.value) }))} valueLabel={t.focus}>
            <ColumnChart data={derived.focusPerDay} format={(v) => minutesLabel(v)} label={t.focusOverTime} />
          </ChartSection>

          <div className="grid gap-12 md:grid-cols-2">
            <ChartSection title={t.byProject} table={s.byProject.map((p) => ({ label: p.projectId ? p.name : tr.nav.inbox, value: String(p.n) }))} valueLabel={t.tasks}>
              <BarList
                rows={s.byProject.slice(0, 8).map((p) => ({ key: p.projectId ?? "inbox", label: p.projectId ? p.name : tr.nav.inbox, dot: projectDot(p.color), value: p.n }))}
                format={(v) => String(v)}
              />
            </ChartSection>
            <ChartSection title={t.whenFinish} sub={t.byHour} table={derived.hours.map((h) => ({ label: h.label, value: String(h.value) }))} valueLabel={t.tasks}>
              <ColumnChart data={derived.hours} format={t.taskCount} height={150} label={t.byHourLabel} />
            </ChartSection>
          </div>

          <p className="text-xs text-ink-3">
            {t.added(s.created)}
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
  const t = useT().stats;
  return (
    <section aria-label={title} className="border-t border-line pt-4">
      <header className="mb-4 flex items-baseline gap-3">
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {sub && <span className="text-xs text-ink-3">{sub}</span>}
        <Button variant="ghost" size="sm" className="ml-auto" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          <Icon icon={Table2} size="xs" /> {asTable ? t.chart : t.table}
        </Button>
      </header>
      {asTable ? <DataTable caption={title} rows={table} valueLabel={valueLabel} /> : children}
    </section>
  );
}
