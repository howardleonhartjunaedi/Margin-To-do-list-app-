"use client";

import { Pause, Play, Plus, Settings2, SkipForward, Square } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { ViewHeader } from "@/components/tasks/view-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { duration, ease } from "@/design/motion";
import { cn } from "@/lib/cn";
import { useTasks } from "@/lib/data";
import { useStats } from "@/lib/data-productivity";
import * as F from "@/lib/focus";
import type { View } from "@/lib/types";
import { useFocus } from "./focus-provider";
import { useT } from "@/i18n/client";

const R = 128;
const C = 2 * Math.PI * R;

export function FocusView() {
  const { today } = useAppUI();
  const f = useFocus();
  const { timer, now, prefs } = f;
  const view = useMemo<View>(() => ({ kind: "today", today }), [today]);
  const todays = (useTasks(view).data ?? []).filter((t) => !t.completedAt);
  const stats = useStats(today, today).data;
  const minutesToday = stats?.focusMinutesByDay[today] ?? 0;

  const [picked, setPicked] = useState<F.Phase>("focus");
  const phase: F.Phase = timer?.phase ?? picked;
  const remainingMs = timer ? F.remaining(timer, now) : F.phaseMinutes(phase, prefs) * 60_000;
  const prog = timer ? F.progress(timer, now) : 0;
  const isBreak = phase !== "focus";
  const round = (timer?.round ?? 0) % prefs.roundsPerLong;
  const tr = useT();
  const t = tr.focus;
  const PHASE_LABEL = t.phases;

  return (
    <>
      <ViewHeader
        title={tr.nav.focus}
        sub={t.focusedToday(F.minutesLabel(minutesToday))}
        actions={<FocusSettings />}
      />

      <div className="grid items-center gap-10 md:grid-cols-[auto_1fr]">
        {/* Ring */}
        <div className="relative mx-auto size-[min(300px,80vw)]" role="timer" aria-live="off" aria-label={t.timerLeft(PHASE_LABEL[phase], F.clock(remainingMs))}>
          <svg viewBox="0 0 300 300" className="size-full -rotate-90">
            <circle cx="150" cy="150" r={R} fill="none" stroke="var(--c-sunken)" strokeWidth="6" />
            <circle
              cx="150"
              cy="150"
              r={R}
              fill="none"
              stroke={isBreak ? "var(--c-success)" : "var(--c-accent)"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - prog)}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <motion.p
                key={phase}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: duration.base, ease: ease.enter }}
                className="font-mono text-2xs tracking-wider text-ink-3 uppercase"
              >
                {timer?.pausedAt ? t.paused : PHASE_LABEL[phase]}
              </motion.p>
              <p className={cn("mt-1 font-mono text-5xl text-ink tabular-nums", timer?.pausedAt && "text-ink-3")}>{F.clock(remainingMs)}</p>
              <div className="mt-3 flex justify-center gap-1.5" role="img" aria-label={t.round(round + 1, prefs.roundsPerLong)}>
                {Array.from({ length: prefs.roundsPerLong }, (_, i) => (
                  <span key={i} className={cn("size-1.5 rounded-full", i < round ? "bg-accent" : "bg-line-strong")} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex max-w-md flex-col gap-6">
          {!timer && (
            <Segmented<F.Phase>
              label={t.sessionType}
              value={phase}
              onValueChange={setPicked}
              options={(["focus", "short", "long"] as F.Phase[]).map((p) => ({ value: p, label: PHASE_LABEL[p] }))}
              className="self-start"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!timer ? (
              <Button variant="primary" size="lg" magnetic onClick={() => f.start(picked)}>
                <Icon icon={Play} /> {t.start(F.phaseMinutes(picked, prefs))}
              </Button>
            ) : timer.pausedAt ? (
              <Button variant="primary" size="lg" magnetic onClick={f.resume}>
                <Icon icon={Play} /> {t.resume}
              </Button>
            ) : (
              <Button variant="primary" size="lg" onClick={f.pause}>
                <Icon icon={Pause} /> {t.pause}
              </Button>
            )}
            {timer && (
              <>
                <Tooltip content={t.add5}>
                  <Button size="lg" onClick={() => f.adjust(5)} aria-label={t.add5}>
                    <Icon icon={Plus} /> 5
                  </Button>
                </Tooltip>
                <Tooltip content={isBreak ? t.skipBreak : t.skipToBreak}>
                  <Button size="lg" variant="ghost" onClick={f.skip} aria-label={isBreak ? t.skipBreak : t.skipToBreak}>
                    <Icon icon={SkipForward} />
                  </Button>
                </Tooltip>
                <Tooltip content={t.stopHint}>
                  <Button size="lg" variant="ghost" onClick={f.stop} aria-label={t.stop}>
                    <Icon icon={Square} />
                  </Button>
                </Tooltip>
              </>
            )}
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-2">{t.workingOn}</span>
            <select
              value={timer?.taskId ?? ""}
              disabled={!timer}
              onChange={(e) => {
                const t = todays.find((x) => x.id === e.target.value);
                f.setTask(t ? { id: t.id, title: t.title } : null);
              }}
              className="h-10 rounded-md bg-raised px-3 text-sm text-ink ring-1 ring-control ring-inset disabled:opacity-60"
            >
              <option value="">{timer ? t.nothingParticular : t.startToPick}</option>
              {timer?.taskId && !todays.some((t) => t.id === timer.taskId) && <option value={timer.taskId}>{f.taskTitle}</option>}
              {todays.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <span className="text-xs text-ink-3">
              {t.fromAnyTask(
                <span key="f" className="text-ink-2">
                  {tr.detail.focus}
                </span>,
              )}
              <Link href="/today" className="underline decoration-line-strong underline-offset-4 hover:text-ink-2">
                {t.todaysList}
              </Link>
            </span>
          </label>
        </div>
      </div>
    </>
  );
}

function FocusSettings() {
  const { prefs, setPrefs } = useFocus();
  const t = useT().focus;
  const num = (key: "focusMin" | "shortMin" | "longMin" | "roundsPerLong", label: string, max: number) => (
    <label className="flex items-center justify-between gap-4 text-sm text-ink">
      {label}
      <input
        type="number"
        min={1}
        max={max}
        value={prefs[key]}
        onChange={(e) => {
          const v = Math.max(1, Math.min(max, Number(e.target.value) || 1));
          setPrefs({ [key]: v });
        }}
        className="h-8 w-16 rounded-md bg-raised px-2 text-right font-mono text-xs text-ink ring-1 ring-control ring-inset"
      />
    </label>
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t.settings}>
          <Icon icon={Settings2} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3 p-4">
        {num("focusMin", t.focusMinutes, 180)}
        {num("shortMin", t.shortBreak, 60)}
        {num("longMin", t.longBreak, 90)}
        {num("roundsPerLong", t.rounds, 8)}
        <label className="flex items-center justify-between text-sm text-ink">
          {t.autoBreaks}
          <Switch checked={prefs.autoStartBreaks} onCheckedChange={(v) => setPrefs({ autoStartBreaks: v })} />
        </label>
        <label className="flex items-center justify-between text-sm text-ink">
          {t.chime}
          <Switch checked={prefs.sound} onCheckedChange={(v) => setPrefs({ sound: v })} />
        </label>
      </PopoverContent>
    </Popover>
  );
}

/** Compact running timer for the sidebar. Hidden when idle. */
export function FocusPill({ onNavigate }: { onNavigate?: () => void }) {
  const { timer, now, pause, resume } = useFocus();
  const t = useT().focus;
  if (!timer) return null;
  const isBreak = timer.phase !== "focus";
  return (
    <div className="flex items-center gap-1 rounded-md bg-sunken px-2 py-1">
      <Link href="/focus" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-sm text-ink">
        <span className={cn("size-2 shrink-0 rounded-full", timer.pausedAt ? "bg-ink-3" : isBreak ? "bg-success" : "bg-accent")} />
        <span className="font-mono text-xs tabular-nums">{F.clock(F.remaining(timer, now))}</span>
        <span className="truncate text-xs text-ink-2">{isBreak ? t.break : (timer.taskTitle ?? t.phases.focus)}</span>
      </Link>
      <Button variant="ghost" size="icon-sm" aria-label={timer.pausedAt ? t.resume : t.pause} onClick={timer.pausedAt ? resume : pause}>
        <Icon icon={timer.pausedAt ? Play : Pause} size="xs" />
      </Button>
    </div>
  );
}
