"use client";

import { AnimatePresence, motion } from "motion/react";
import { forwardRef, useMemo, useRef } from "react";
import { CalendarDays, Clock, Flag, FolderPlus, Hash, Hourglass, Repeat, Tag } from "lucide-react";
import { minutesLabel } from "@/lib/focus";
import { Icon } from "@/components/ui/icon";
import { spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";
import { formatDue, formatTime } from "@/lib/dates";
import type { ParsedTask, TokenKind } from "@/lib/quick-add/parse";
import { describeRRule } from "@/lib/quick-add/rrule";

const MARK: Record<TokenKind, string> = {
  date: "bg-accent-soft text-ink",
  recurrence: "bg-accent-soft text-ink",
  priority: "bg-warning-soft text-ink",
  project: "bg-sunken text-ink ring-1 ring-line-strong ring-inset",
  label: "bg-sunken text-ink",
  estimate: "bg-success-soft text-ink",
};

interface SmartInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onValueChange: (v: string) => void;
  parsed: ParsedTask;
}

/**
 * A single-line input that highlights what it understood, in place.
 * A mirror layer behind a transparent-text input draws the marks; the caret and
 * selection stay native.
 */
export const SmartInput = forwardRef<HTMLInputElement, SmartInputProps>(function SmartInput(
  { value, onValueChange, parsed, className, ...rest },
  ref,
) {
  const mirror = useRef<HTMLDivElement>(null);
  const segments = useMemo(() => {
    const out: { text: string; kind?: TokenKind }[] = [];
    let at = 0;
    for (const t of parsed.tokens) {
      if (t.start > at) out.push({ text: value.slice(at, t.start) });
      out.push({ text: value.slice(t.start, t.end), kind: t.kind });
      at = t.end;
    }
    if (at < value.length) out.push({ text: value.slice(at) });
    return out;
  }, [parsed.tokens, value]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        ref={mirror}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden px-0 py-2 text-lg whitespace-pre text-ink"
      >
        {segments.map((s, i) =>
          s.kind ? (
            <mark key={i} className={cn("rounded-sm", MARK[s.kind])}>
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </div>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onScroll={(e) => {
          if (mirror.current) mirror.current.scrollLeft = e.currentTarget.scrollLeft;
        }}
        spellCheck={false}
        autoComplete="off"
        className="relative w-full bg-transparent py-2 text-lg text-transparent caret-ink outline-none placeholder:text-ink-3 selection:bg-accent-soft selection:text-transparent"
        {...rest}
      />
    </div>
  );
});

/** The parsed fields, as chips that spring in as you type them. */
export function ParsedChips({
  parsed,
  today,
  projectName,
  defaults,
}: {
  parsed: ParsedTask;
  today: string;
  projectName?: string;
  defaults?: { dueDate?: string | null };
}) {
  const t = useT().quick;
  const due = parsed.dueDate ?? defaults?.dueDate ?? null;
  const chips: { key: string; icon: typeof Flag; text: string; tone?: string; implied?: boolean }[] = [];
  if (due)
    chips.push({
      key: "date",
      icon: CalendarDays,
      text: formatDue(due, today),
      tone: due < today ? "text-danger" : undefined,
      implied: !parsed.dueDate,
    });
  if (parsed.dueTime) chips.push({ key: "time", icon: Clock, text: formatTime(parsed.dueTime) });
  if (parsed.recurrence) chips.push({ key: "rec", icon: Repeat, text: describeRRule(parsed.recurrence.rrule) });
  if (parsed.priority < 4) chips.push({ key: "pri", icon: Flag, text: `P${parsed.priority}`, tone: `text-p${parsed.priority}` });
  if (parsed.project) chips.push({ key: "proj", icon: Hash, text: parsed.project.name });
  else if (parsed.unknownProject) chips.push({ key: "newproj", icon: FolderPlus, text: t.newProject(parsed.unknownProject) });
  else if (projectName) chips.push({ key: "proj", icon: Hash, text: projectName, implied: true });
  for (const l of parsed.labels) chips.push({ key: `l-${l.toLowerCase()}`, icon: Tag, text: l });
  if (parsed.estimateMinutes) chips.push({ key: "est", icon: Hourglass, text: `~${minutesLabel(parsed.estimateMinutes)}` });

  return (
    <ul className="flex min-h-7 flex-wrap items-center gap-1.5" aria-live="polite" aria-label={t.understood}>
      <AnimatePresence initial={false} mode="popLayout">
        {chips.map((c) => (
          <motion.li
            key={c.key}
            layout
            initial={{ opacity: 0, scale: 0.85, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={spring.pop}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-xs",
              c.implied ? "border border-dashed border-line-strong text-ink-2" : "bg-sunken text-ink",
            )}
            title={c.implied ? t.fromPage : undefined}
          >
            <Icon icon={c.icon} size="xs" className={cn("text-ink-3", c.tone === "text-p1" && "text-p1", c.tone === "text-p2" && "text-p2", c.tone === "text-p3" && "text-p3")} />
            <span className={cn(c.tone === "text-danger" && "text-danger")}>{c.text}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
