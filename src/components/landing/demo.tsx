"use client";

import { ArrowRight, CornerDownLeft, Repeat } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ParsedChips, SmartInput } from "@/components/tasks/smart-input";
import { Button } from "@/components/ui/button";
import { TaskCheckbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { PriorityFlag } from "@/components/ui/priority";
import { spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { UiRoot } from "@/components/providers/ui-root";
import { formatDue, formatTime, todayISO } from "@/lib/dates";
import { parseQuickAdd, type ParsedTask } from "@/lib/quick-add/parse";
import { useT } from "@/i18n/client";

export const DEMO_KEY = "margin:demo-tasks";

interface Added {
  id: string;
  line: string;
  parsed: ParsedTask;
  done: boolean;
}

/** The real quick-add parser, running in the page. Nothing is sent anywhere until you sign up. */
export default function Demo() {
  const [text, setText] = useState("");
  const [added, setAdded] = useState<Added[]>([]);
  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const today = todayISO();
  const tr = useT();
  const t = tr.landing;

  const add = (line = text) => {
    const p = parseQuickAdd(line);
    if (!p.title) return;
    setAdded((a) => [{ id: crypto.randomUUID(), line, parsed: p, done: false }, ...a].slice(0, 6));
    setText("");
  };

  const keep = () => {
    try {
      localStorage.setItem(
        DEMO_KEY,
        added
          .filter((a) => !a.done)
          .map((a) => a.line)
          .join("\n"),
      );
    } catch {}
  };

  return (
    <UiRoot>
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
            className="rounded-md bg-raised p-4 shadow-2 ring-1 ring-line"
          >
            <SmartInput value={text} onValueChange={setText} parsed={parsed} placeholder={t.demoPlaceholder} aria-label={t.demoLabel} />
            <div className="mt-2 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <ParsedChips parsed={parsed} today={today} />
              </div>
              <Button type="submit" variant="primary" size="sm" disabled={!parsed.title}>
                {t.add} <Icon icon={CornerDownLeft} size="xs" />
              </Button>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {t.examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setText(ex)}
                className="rounded-sm bg-sunken px-2.5 py-1.5 font-mono text-2xs text-ink-2 transition-colors duration-(--dur-fast) hover:text-ink active:scale-[0.97]"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between border-b border-line pb-2">
            <h3 className="font-display text-xl text-ink">{t.yourList}</h3>
            <span className="font-mono text-2xs text-ink-3">{added.filter((a) => !a.done).length} {t.open}</span>
          </div>
          <ul>
            <AnimatePresence initial={false} mode="popLayout">
              {added.map((a) => (
                <motion.li
                  key={a.id}
                  layout="position"
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ ...spring.pop, layout: spring.layout }}
                  className="flex items-start gap-3 border-b border-line py-3"
                >
                  <div className="pt-0.5">
                    <TaskCheckbox
                      checked={a.done}
                      priority={a.parsed.priority}
                      onCheckedChange={() => setAdded((xs) => xs.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)))}
                      aria-label={`${tr.item.complete}: ${a.parsed.title}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", a.done ? "text-ink-3 line-through" : "text-ink")}>{a.parsed.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
                      {a.parsed.dueDate && (
                        <span className="inline-flex items-center gap-1 font-mono text-2xs">
                          {formatDue(a.parsed.dueDate, today, a.parsed.dueTime)}
                          {a.parsed.recurrence && <Icon icon={Repeat} size="xs" label="Repeats" />}
                        </span>
                      )}
                      {!a.parsed.dueDate && a.parsed.dueTime && <span className="font-mono text-2xs">{formatTime(a.parsed.dueTime)}</span>}
                      {a.parsed.priority < 4 && <PriorityFlag priority={a.parsed.priority} />}
                      {(a.parsed.project?.name ?? a.parsed.unknownProject) && <span>#{a.parsed.project?.name ?? a.parsed.unknownProject}</span>}
                      {a.parsed.labels.map((l) => (
                        <span key={l} className="text-ink-3">
                          @{l}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {added.length === 0 ? (
            <p className="py-6 text-sm text-ink-3">{t.demoEmpty}</p>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5">
              <Button asChild variant="secondary" onClick={keep}>
                <Link href="/sign-up">
                  {t.keep} <Icon icon={ArrowRight} />
                </Link>
              </Button>
              <p className="mt-2 text-xs text-ink-3">{t.keepNote}</p>
            </motion.div>
          )}
        </div>
      </div>
    </UiRoot>
  );
}
