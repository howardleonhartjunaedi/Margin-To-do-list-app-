"use client";

import { BellPlus, BellRing, X } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { useReminderActions } from "@/lib/data";
import { formatInstant } from "@/lib/dates";
import { describeOffset } from "@/lib/time/reminders";
import type { ReminderInfo, Task } from "@/lib/types";

const PRESETS = [0, 10, 30, 60, 1440];

export function RemindersSection({ task, reminders }: { task: Task; reminders: ReminderInfo[] }) {
  const { today } = useAppUI();
  const { add, remove } = useReminderActions(task.id);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const label = (r: ReminderInfo) => (r.offsetMinutes != null ? describeOffset(r.offsetMinutes) : "At a set time");
  const status = (r: ReminderInfo) =>
    r.status === "sent" ? "Sent" : r.status === "skipped" ? "Passed" : r.status === "failed" ? "Couldn’t send" : null;

  return (
    <section className="mt-8" aria-labelledby="reminders-h">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <h3 id="reminders-h" className="font-mono text-2xs tracking-wider text-ink-3 uppercase">
          Reminders
        </h3>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="-my-1 h-7 px-2 text-xs">
              <Icon icon={BellPlus} size="xs" /> Add
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1.5">
            {!task.dueDate && (
              <p className="px-2 pt-1 pb-2 text-xs text-ink-3">Give the task a date to remind before it — or pick an exact time below.</p>
            )}
            {PRESETS.map((m) => (
              <button
                key={m}
                disabled={!task.dueDate}
                onClick={() => {
                  setOpen(false);
                  void add({ offsetMinutes: m });
                }}
                className="flex h-9 w-full items-center rounded-sm px-2 text-left text-sm text-ink outline-none hover:bg-sunken focus-visible:bg-sunken disabled:pointer-events-none disabled:text-ink-3"
              >
                {describeOffset(m)}
              </button>
            ))}
            <form
              className="mt-1 flex items-center gap-2 border-t border-line px-2 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!custom) return;
                setOpen(false);
                void add({ at: new Date(custom).toISOString() });
                setCustom("");
              }}
            >
              <input
                type="datetime-local"
                aria-label="Remind at"
                data-cursor="native"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="min-w-0 flex-1 rounded-sm bg-raised px-1.5 py-1 font-mono text-2xs text-ink ring-1 ring-control ring-inset"
              />
              <Button size="sm" type="submit" className="h-7 px-2 text-xs" disabled={!custom}>
                Set
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </div>

      {reminders.length === 0 ? (
        <p className="py-3 text-sm text-ink-3">
          No reminders.{" "}
          <Link href="/settings" className="underline decoration-line-strong underline-offset-4 hover:text-ink-2">
            Choose where they reach you
          </Link>
          .
        </p>
      ) : (
        <ul>
          <AnimatePresence initial={false}>
            {reminders.map((r) => (
              <motion.li
                key={r.id}
                layout="position"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring.pop}
                className="group flex items-center gap-3 border-b border-line py-2.5"
              >
                <Icon icon={BellRing} size="xs" className={r.status === "pending" ? "text-accent" : "text-ink-3"} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", r.status === "pending" ? "text-ink" : "text-ink-2")}>{label(r)}</p>
                  <p className="font-mono text-2xs text-ink-3">
                    {r.fireAt ? formatInstant(r.fireAt, today) : "Needs a date"}
                    {status(r) && <span> · {status(r)}</span>}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove reminder: ${label(r)}`}
                  className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                  onClick={() => void remove(r.id)}
                >
                  <Icon icon={X} size="xs" />
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
