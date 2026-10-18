"use client";

import { Check, ListTree, Wand } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { PriorityFlag } from "@/components/ui/priority";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { spring } from "@/design/motion";
import { api, ApiError, type TriageSuggestion } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useSettings, useTaskActions, useTasks } from "@/lib/data";
import { formatDue, todayISO } from "@/lib/dates";
import { minutesLabel } from "@/lib/focus";
import type { Task, View } from "@/lib/types";
import { useT } from "@/i18n/client";
import { m } from "@/i18n/catalogs";

/*
 * AI suggestions: shown only when the server has a model configured and the user has
 * turned them on (Settings). Every suggestion is a proposal — nothing changes until it's accepted.
 */

export function useAiEnabled() {
  const s = useSettings().data;
  return !!s?.aiAvailable && !!s.aiEnabled;
}

const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : m().ai.failed);

/* ------------------------------ Break a task down ------------------------------ */

export function SuggestSteps({ parent }: { parent: Task }) {
  const enabled = useAiEnabled();
  const actions = useTaskActions();
  const [state, setState] = useState<"idle" | "loading" | "ready">("idle");
  const [steps, setSteps] = useState<{ title: string; estimateMinutes: number | null; keep: boolean }[]>([]);
  const t = useT().ai;

  if (!enabled) return null;

  const run = async () => {
    setState("loading");
    try {
      const r = await api.aiBreakdown(parent.id);
      setSteps(r.steps.map((s) => ({ ...s, keep: true })));
      setState(r.steps.length ? "ready" : "idle");
      if (!r.steps.length) toast(t.noSteps);
    } catch (e) {
      setState("idle");
      fail(e);
    }
  };

  const add = () => {
    const chosen = steps.filter((s) => s.keep);
    for (const s of chosen)
      void actions.create({ id: crypto.randomUUID(), title: s.title, parentId: parent.id, projectId: parent.projectId, estimateMinutes: s.estimateMinutes });
    toast(t.addedSteps(chosen.length));
    setState("idle");
    setSteps([]);
  };

  if (state === "idle")
    return (
      <Button variant="ghost" size="sm" className="mt-1 -ml-2 text-ink-2" onClick={() => void run()}>
        <Icon icon={ListTree} size="xs" /> {t.suggestSteps}
      </Button>
    );

  return (
    <div className="mt-3 rounded-md bg-surface p-3 ring-1 ring-line" aria-live="polite" aria-busy={state === "loading"}>
      <p className="mb-2 text-xs text-ink-2">{state === "loading" ? t.working : t.suggested}</p>
      {state === "loading" ? (
        <div className="flex flex-col gap-2 py-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : (
        <>
          <ul className="flex flex-col">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-3 py-1.5">
                <Checkbox
                  checked={s.keep}
                  onCheckedChange={(v) => setSteps((xs) => xs.map((x, j) => (j === i ? { ...x, keep: v === true } : x)))}
                  aria-label={t.keep(s.title)}
                />
                <span className={cn("min-w-0 flex-1 text-sm", s.keep ? "text-ink" : "text-ink-3 line-through")}>{s.title}</span>
                {s.estimateMinutes && <span className="font-mono text-2xs text-ink-3">~{minutesLabel(s.estimateMinutes)}</span>}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" disabled={!steps.some((s) => s.keep)} onClick={add}>
              {t.addSteps(steps.filter((s) => s.keep).length)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => (setState("idle"), setSteps([]))}>
              {t.dismiss}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------ Sort the Inbox ------------------------------ */

const inboxView: View = { kind: "inbox" };

export function SortInboxButton() {
  const enabled = useAiEnabled();
  const [open, setOpen] = useState(false);
  const t = useT().ai;
  if (!enabled) return null;
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Icon icon={Wand} size="xs" /> {t.sortInbox}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={t.sortInbox}>
        {open && <TriagePanel onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

function TriagePanel({ onDone }: { onDone: () => void }) {
  const actions = useTaskActions();
  const inbox = useTasks(inboxView).data ?? [];
  const [items, setItems] = useState<TriageSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();
  const t = useT().ai;

  // Ask once when the panel opens.
  useEffect(() => {
    let live = true;
    api.aiTriage().then(
      (r) => live && setItems(r.suggestions),
      (e) => live && setError(e instanceof ApiError ? e.message : m().ai.failed),
    );
    return () => {
      live = false;
    };
  }, []);

  const apply = (s: TriageSuggestion) => {
    const t = inbox.find((x) => x.id === s.taskId);
    setItems((xs) => xs?.filter((x) => x.taskId !== s.taskId) ?? null);
    if (!t) return; // already moved or done elsewhere
    void actions.update(t, {
      ...(s.projectId ? { projectId: s.projectId } : {}),
      ...(s.dueDate ? { dueDate: s.dueDate } : {}),
      ...(s.priority !== t.priority ? { priority: s.priority } : {}),
    });
  };
  const skip = (s: TriageSuggestion) => setItems((xs) => xs?.filter((x) => x.taskId !== s.taskId) ?? null);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-5 pt-5 pb-4">
        <h2 className="font-display text-2xl text-ink">{t.sortInbox}</h2>
        <p className="mt-1 text-sm text-ink-2">{t.sortLede}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3" aria-live="polite" aria-busy={!items && !error}>
        {error ? (
          <p className="py-6 text-sm text-ink-2">{error}</p>
        ) : !items ? (
          <div className="flex flex-col gap-4 py-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-sm text-ink-2">{t.sorted}</p>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {items.map((s) => (
                <motion.li
                  key={s.taskId}
                  layout="position"
                  exit={{ opacity: 0, x: 16 }}
                  transition={spring.layout}
                  className="border-b border-line py-3.5"
                >
                  <p className="text-sm text-ink">{s.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
                    {s.projectName && <span>→ #{s.projectName}</span>}
                    {s.dueDate && <span className="font-mono text-2xs">{formatDue(s.dueDate, today)}</span>}
                    {s.priority < 4 && <PriorityFlag priority={s.priority} />}
                  </div>
                  <p className="mt-1 text-xs text-ink-3">{s.reason}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => apply(s)}>
                      <Icon icon={Check} size="xs" /> {t.apply}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => skip(s)}>
                      {t.skip}
                    </Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
      {items && items.length > 1 && (
        <div className="border-t border-line px-5 py-3">
          <Button
            variant="primary"
            onClick={() => {
              items.forEach(apply);
              onDone();
            }}
          >
            {t.applyAll(items.length)}
          </Button>
        </div>
      )}
    </div>
  );
}
