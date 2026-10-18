"use client";

import { Bookmark, ListFilter, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { useCounts, useProjects } from "@/lib/data";
import { useFilterActions } from "@/lib/data-filters";
import { decodeFilter, DUE_BUCKETS, dueLabel, encodeFilter, EMPTY_FILTER, isEmptyFilter, type Filter } from "@/lib/filters";
import { useT } from "@/i18n/client";
import { projectDot } from "@/lib/project-colors";
import type { Priority } from "@/lib/types";
import { useUrlParam } from "@/lib/view-transition";

export function useFilterParam(initial?: string) {
  const [raw, set] = useUrlParam("f", initial ?? "");
  const filter = useMemo(() => decodeFilter(raw), [raw]);
  return [filter, (f: Filter) => set(encodeFilter(f))] as const;
}

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-xs transition-colors duration-(--dur-fast)",
        on ? "bg-ink text-bg" : "bg-sunken text-ink-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function FilterButton({ filter, onChange, hideProjects }: { filter: Filter; onChange: (f: Filter) => void; hideProjects?: boolean }) {
  const { today } = useAppUI();
  const tr = useT();
  const t = tr.filter;
  const projects = useProjects().data ?? [];
  const labels = useCounts(today).data?.labels ?? [];
  const active =
    filter.priorities.length + filter.projects.length + filter.labels.length + filter.due.length + (filter.text.trim() ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant={active ? "secondary" : "ghost"}>
          <Icon icon={ListFilter} /> {t.filter}
          {active > 0 && <span className="font-mono text-2xs text-ink-3">{active}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[min(340px,calc(100vw-24px))] flex-col gap-4 p-4">
        <Input
          value={filter.text}
          onChange={(e) => onChange({ ...filter, text: e.target.value })}
          placeholder={t.textPlaceholder}
          aria-label={t.byText}
        />
        <fieldset>
          <legend className="mb-2 font-mono text-2xs tracking-wider text-ink-3 uppercase">{t.priority}</legend>
          <div className="flex flex-wrap gap-1.5">
            {([1, 2, 3, 4] as Priority[]).map((p) => (
              <Chip key={p} on={filter.priorities.includes(p)} onClick={() => onChange({ ...filter, priorities: toggle(filter.priorities, p) })}>
                P{p}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 font-mono text-2xs tracking-wider text-ink-3 uppercase">{t.date}</legend>
          <div className="flex flex-wrap gap-1.5">
            {DUE_BUCKETS.map((d) => (
              <Chip key={d} on={filter.due.includes(d)} onClick={() => onChange({ ...filter, due: toggle(filter.due, d) })}>
                {dueLabel(d)}
              </Chip>
            ))}
          </div>
        </fieldset>
        {!hideProjects && (
          <fieldset>
            <legend className="mb-2 font-mono text-2xs tracking-wider text-ink-3 uppercase">{t.project}</legend>
            <div className="flex flex-wrap gap-1.5">
              <Chip on={filter.projects.includes("inbox")} onClick={() => onChange({ ...filter, projects: toggle(filter.projects, "inbox") })}>
                {tr.nav.inbox}
              </Chip>
              {projects.map((p) => (
                <Chip key={p.id} on={filter.projects.includes(p.id)} onClick={() => onChange({ ...filter, projects: toggle(filter.projects, p.id) })}>
                  <span className={cn("size-2 rounded-full", projectDot(p.color))} />
                  {p.name}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
        {labels.length > 0 && (
          <fieldset>
            <legend className="mb-2 font-mono text-2xs tracking-wider text-ink-3 uppercase">{t.label}</legend>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => (
                <Chip key={l} on={filter.labels.includes(l)} onClick={() => onChange({ ...filter, labels: toggle(filter.labels, l) })}>
                  @{l}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
        {active > 0 && (
          <Button size="sm" variant="ghost" className="self-start" onClick={() => onChange(EMPTY_FILTER)}>
            {t.clearAll}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** The active filter as removable chips, plus save / update. Renders nothing when empty. */
export function ActiveFilters({
  filter,
  onChange,
  savedId,
  savedQuery,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
  savedId?: string;
  savedQuery?: string;
}) {
  const projects = useProjects().data ?? [];
  const tr = useT();
  const t = tr.filter;
  const { create, update } = useFilterActions();
  const router = useRouter();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const encoded = encodeFilter(filter);
  const dirty = savedId !== undefined && encoded !== savedQuery;

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filter.priorities.map((p) => ({ key: `p${p}`, label: `P${p}`, remove: () => onChange({ ...filter, priorities: filter.priorities.filter((x) => x !== p) }) })),
    ...filter.due.map((d) => ({ key: `d${d}`, label: dueLabel(d), remove: () => onChange({ ...filter, due: filter.due.filter((x) => x !== d) }) })),
    ...filter.projects.map((id) => ({
      key: `pr${id}`,
      label: id === "inbox" ? tr.nav.inbox : (projects.find((p) => p.id === id)?.name ?? t.deletedProject),
      remove: () => onChange({ ...filter, projects: filter.projects.filter((x) => x !== id) }),
    })),
    ...filter.labels.map((l) => ({ key: `l${l}`, label: `@${l}`, remove: () => onChange({ ...filter, labels: filter.labels.filter((x) => x !== l) }) })),
    ...(filter.text.trim() ? [{ key: "q", label: `“${filter.text.trim()}”`, remove: () => onChange({ ...filter, text: "" }) }] : []),
  ];
  if (isEmptyFilter(filter) && !dirty) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-1.5">
      <AnimatePresence initial={false} mode="popLayout">
        {chips.map((c) => (
          <motion.span
            key={c.key}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={spring.pop}
            className="inline-flex h-7 items-center gap-1 rounded-sm bg-sunken pr-1 pl-2 text-xs text-ink"
          >
            {c.label}
            <button type="button" onClick={c.remove} aria-label={t.remove(c.label)} className="grid size-5 place-items-center rounded-sm text-ink-3 hover:bg-raised hover:text-ink">
              <Icon icon={X} size="xs" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <div className="ml-auto flex items-center gap-1">
        {savedId && dirty && (
          <Button size="sm" variant="secondary" onClick={() => void update(savedId, { query: encoded })}>
            {t.update}
          </Button>
        )}
        {!savedId && !isEmptyFilter(filter) && (
          <Popover open={naming} onOpenChange={setNaming}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost">
                <Icon icon={Bookmark} /> {t.save}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!name.trim()) return;
                  const id = crypto.randomUUID();
                  setNaming(false);
                  const saved = await create({ id, name: name.trim(), query: encoded });
                  if (saved) router.push(`/filter/${id}?f=${encodeURIComponent(encoded)}`);
                }}
              >
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} aria-label={t.name} />
                <Button type="submit" size="md" variant="primary" disabled={!name.trim()}>
                  {t.save}
                </Button>
              </form>
            </PopoverContent>
          </Popover>
        )}
        <Button size="sm" variant="ghost" onClick={() => onChange(savedQuery !== undefined ? decodeFilter(savedQuery) : EMPTY_FILTER)}>
          {savedId ? t.reset : t.clear}
        </Button>
      </div>
    </div>
  );
}
