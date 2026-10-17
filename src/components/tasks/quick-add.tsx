"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, CornerDownLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { Kbd } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { duration, ease } from "@/design/motion";
import { truncate, useProjectActions, useProjects, useTaskActions } from "@/lib/data";
import { formatDue } from "@/lib/dates";
import { parseQuickAdd } from "@/lib/quick-add/parse";
import { ParsedChips, SmartInput } from "./smart-input";

/**
 * Global quick add (Q). Type a line, press Enter, keep typing.
 * It stays open for rapid capture and says exactly where each task went.
 */
export function QuickAddDialog() {
  const { quickAdd, closeQuickAdd, today } = useAppUI();
  return (
    <DialogPrimitive.Root open={quickAdd.open} onOpenChange={(o) => !o && closeQuickAdd()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby="quick-add-help"
          className="fixed inset-x-3 top-[12vh] z-40 mx-auto max-w-xl rounded-md bg-raised shadow-3 ring-1 ring-line outline-none [--pop-y:-8px] data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
        >
          <DialogPrimitive.Title className="sr-only">Add a task</DialogPrimitive.Title>
          <QuickAddForm defaults={quickAdd.defaults} today={today} onDone={closeQuickAdd} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function QuickAddForm({
  defaults,
  today,
  onDone,
}: {
  defaults: { projectId?: string | null; dueDate?: string | null; priority?: 1 | 2 | 3 | 4; text?: string };
  today: string;
  onDone: () => void;
}) {
  const [text, setText] = useState(defaults.text ?? "");
  const [added, setAdded] = useState<{ id: string; text: string } | null>(null);
  const projects = useProjects().data ?? [];
  const { create } = useTaskActions();
  const projectActions = useProjectActions();
  const input = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseQuickAdd(text, { projects }), [text, projects]);
  const defaultProject = projects.find((p) => p.id === defaults.projectId);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(null), 4000);
    return () => clearTimeout(t);
  }, [added]);

  const submit = async () => {
    if (!parsed.title) return;
    let projectId = parsed.project?.id ?? defaults.projectId ?? null;
    let projectName = parsed.project?.name ?? defaultProject?.name;
    if (parsed.unknownProject) {
      const name = parsed.unknownProject[0].toUpperCase() + parsed.unknownProject.slice(1);
      const p = await projectActions.create({ id: crypto.randomUUID(), name });
      if (!p) return;
      projectId = p.id;
      projectName = p.name;
    }
    const dueDate = parsed.dueDate ?? defaults.dueDate ?? null;
    const id = crypto.randomUUID();
    setText("");
    const where = [projectName ?? "Inbox", dueDate && formatDue(dueDate, today, parsed.dueTime)].filter(Boolean).join(", ");
    setAdded({ id, text: `Added “${truncate(parsed.title, 32)}” to ${where}.` });
    await create({
      id,
      title: parsed.title,
      projectId,
      dueDate,
      dueTime: dueDate ? parsed.dueTime : null,
      priority: parsed.priority < 4 ? parsed.priority : (defaults.priority ?? 4),
      recurrence: parsed.recurrence?.rrule ?? null,
      estimateMinutes: parsed.estimateMinutes,
      labels: parsed.labels,
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="px-4 pt-3">
        <SmartInput
          ref={input}
          autoFocus
          value={text}
          onValueChange={setText}
          parsed={parsed}
          placeholder="Call Sam tomorrow 4pm #work p2"
          aria-label="Task, with optional date, priority, #project and @labels"
          onKeyDown={(e) => {
            if (e.key === "Escape" && text) {
              e.preventDefault();
              e.stopPropagation();
              setText("");
            }
          }}
        />
      </div>
      <div className="px-4 pt-1 pb-3">
        <ParsedChips parsed={parsed} today={today} projectName={defaultProject?.name} defaults={defaults} />
      </div>
      <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-2.5">
        <div className="min-w-0 flex-1 text-xs text-ink-2" id="quick-add-help">
          <AnimatePresence mode="wait" initial={false}>
            {added ? (
              <motion.p
                key={added.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.base, ease: ease.enter }}
                className="flex items-center gap-1.5 text-ink"
                role="status"
              >
                <Icon icon={Check} size="xs" className="text-success" />
                <span className="truncate">{added.text}</span>
              </motion.p>
            ) : (
              <motion.p key="help" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="truncate text-ink-3">
                Try <span className="font-mono text-2xs text-ink-2">fri 9am</span> ·{" "}
                <span className="font-mono text-2xs text-ink-2">every mon</span> ·{" "}
                <span className="font-mono text-2xs text-ink-2">p1</span> ·{" "}
                <span className="font-mono text-2xs text-ink-2">#project</span> ·{" "}
                <span className="font-mono text-2xs text-ink-2">@label</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDone} className="max-sm:hidden">
            Done <Kbd>Esc</Kbd>
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!parsed.title}>
            Add <Icon icon={CornerDownLeft} size="xs" />
          </Button>
        </div>
      </div>
    </form>
  );
}
