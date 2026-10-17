"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useProjects, useTaskActions } from "@/lib/data";
import { parseQuickAdd } from "@/lib/quick-add/parse";
import { ParsedChips, SmartInput } from "./smart-input";

/** "Add task" at the foot of a list. Inherits the list's context (its project or day). */
export function InlineAdd({ projectId, dueDate }: { projectId?: string | null; dueDate?: string | null }) {
  const { today } = useAppUI();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const projects = useProjects().data ?? [];
  const { create } = useTaskActions();
  const parsed = useMemo(() => parseQuickAdd(text, { projects }), [text, projects]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group flex h-11 w-full items-center gap-3 rounded-md px-2 text-sm text-ink-3 transition-colors duration-(--dur-fast) hover:text-accent"
      >
        <span className="grid size-5 place-items-center rounded-full transition-colors duration-(--dur-fast) group-hover:bg-accent group-hover:text-accent-ink">
          <Icon icon={Plus} size="xs" />
        </span>
        Add task
      </button>
    );
  }

  const submit = () => {
    if (!parsed.title) return;
    const due = parsed.dueDate ?? dueDate ?? null;
    void create({
      id: crypto.randomUUID(),
      title: parsed.title,
      projectId: parsed.project?.id ?? projectId ?? null,
      dueDate: due,
      dueTime: due ? parsed.dueTime : null,
      priority: parsed.priority,
      recurrence: parsed.recurrence?.rrule ?? null,
      labels: parsed.labels,
    });
    setText("");
  };

  return (
    <form
      className="mt-2 rounded-md bg-raised p-3 ring-1 ring-line"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <SmartInput
        autoFocus
        value={text}
        onValueChange={setText}
        parsed={parsed}
        placeholder="What needs doing?"
        aria-label="New task"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setText("");
          }
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <ParsedChips parsed={parsed} today={today} defaults={{ dueDate }} />
        </div>
        <Button size="sm" variant="ghost" onClick={() => (setOpen(false), setText(""))}>
          Cancel
        </Button>
        <Button size="sm" type="submit" disabled={!parsed.title}>
          Add task
        </Button>
      </div>
    </form>
  );
}
