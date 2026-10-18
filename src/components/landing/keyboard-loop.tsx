"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { UiRoot } from "@/components/providers/ui-root";
import { usePreferences } from "@/components/providers/preferences";
import { Kbd } from "@/components/ui/badge";
import { duration, ease, spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";

/*
 * A short loop that shows the keyboard model in action: move, complete, reschedule,
 * capture. It plays only while on screen and only with Full motion; otherwise it's a still list.
 * Loaded lazily as the section approaches (see lazy-sections.tsx).
 */

type Step = {
  key: string;
  label: string;
  focus: number;
  done: number[];
  moved?: boolean;
  quick?: string;
};

const SCRIPT: Step[] = [
  { key: "J", label: "Next task", focus: 1, done: [] },
  { key: "X", label: "Complete it", focus: 1, done: [1] },
  { key: "J", label: "Next task", focus: 2, done: [1] },
  { key: "T", label: "Reschedule", focus: 2, done: [1], moved: true },
  {
    key: "Q",
    label: "Capture a new one",
    focus: 2,
    done: [1],
    moved: true,
    quick: "Pay invoice fri p1",
  },
];

export default function KeyboardLoop({ today, rows }: { today: string; rows: string[] }) {
  const { motion: level } = usePreferences();
  const t = useT().landing;
  const [i, setI] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      threshold: 0.4,
    });
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || level !== "full") return;
    const id = setInterval(() => setI((n) => (n + 1 >= SCRIPT.length + 1 ? -1 : n + 1)), 1400);
    return () => clearInterval(id);
  }, [visible, level]);

  const step: Step = i >= 0 && i < SCRIPT.length ? { ...SCRIPT[i], label: t.loopSteps[i] } : { key: "", label: "", focus: 0, done: [] };

  return (
    <UiRoot>
      <div ref={box} aria-hidden className="relative rounded-md bg-raised p-5 shadow-2 ring-1 ring-line">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-xl text-ink">{today}</span>
          <AnimatePresence mode="wait">
            {step.key && (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.base, ease: ease.enter }}
                className="flex items-center gap-2 text-xs text-ink-2"
              >
                <motion.span initial={{ scale: 1 }} animate={{ scale: [1, 0.86, 1] }} transition={{ duration: 0.3, times: [0, 0.4, 1] }}>
                  <Kbd className="h-7 min-w-7 text-xs text-ink">{step.key}</Kbd>
                </motion.span>
                {step.label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <ul>
          {rows.map((r, n) => {
            const done = step.done.includes(n);
            const gone = n === 2 && step.moved;
            return (
              <motion.li
                key={r}
                layout
                transition={spring.layout}
                className={cn(
                  "relative flex items-center gap-3 border-b border-line px-2 py-3 text-sm",
                  step.focus === n && i >= 0 && "rounded-sm bg-surface outline-2 -outline-offset-2 outline-focus",
                  gone && "opacity-40",
                )}
              >
                <span className={cn("grid size-4 place-items-center rounded-full ring-[1.5px] ring-inset", done ? "bg-ink-3 ring-ink-3" : "ring-control")} />
                <span className={cn("flex-1", done ? "text-ink-3 line-through" : "text-ink")}>{r}</span>
                {gone && <span className="font-mono text-2xs text-ink-3">{t.loopMoved}</span>}
              </motion.li>
            );
          })}
        </ul>
        <AnimatePresence>
          {step.quick && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.pop}
              className="absolute inset-x-6 top-14 rounded-md bg-raised p-3 shadow-3 ring-1 ring-line"
            >
              <p className="text-sm text-ink">
                {t.loopQuick[0]}
                <mark className="rounded-sm bg-accent-soft text-ink">{t.loopQuick[1]}</mark>
                {t.loopQuick[2]}
                <mark className="rounded-sm bg-warning-soft text-ink">{t.loopQuick[3]}</mark>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </UiRoot>
  );
}
