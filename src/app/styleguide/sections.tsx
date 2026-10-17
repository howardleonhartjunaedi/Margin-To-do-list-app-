"use client";

import {
  Archive,
  Bell,
  CalendarDays,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Flag,
  Hash,
  Inbox,
  LayoutList,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Search,
  Sun,
  Sunrise,
  Tag,
  Timer,
  Trash2,
  Undo2,
  Users,
} from "lucide-react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { usePreferences } from "@/components/providers/preferences";
import { Burst } from "@/components/task/burst";
import { TaskCard } from "@/components/task/task-card";
import { TaskRow, type TaskLite } from "@/components/task/task-row";
import { Badge, Dot, Kbd } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, TaskCheckbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PriorityFlag, type Priority } from "@/components/ui/priority";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, OfflineBanner, TaskRowSkeleton } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { toast, toastWithUndo } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { distance, duration, ease, spring } from "@/design/motion";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Layout primitives for the guide                                     */
/* ------------------------------------------------------------------ */

function Section({
  id,
  n,
  title,
  lede,
  children,
}: {
  id: string;
  n: number;
  title: string;
  lede: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-14 border-b border-line py-14 sm:py-20">
      <header className="mb-10 grid gap-x-6 gap-y-2 sm:grid-cols-[2.5rem_1fr]">
        <span className="pt-2.5 font-mono text-xs text-accent">{String(n).padStart(2, "0")}</span>
        <div>
          <h2 id={`${id}-h`} className="font-display text-3xl font-normal text-ink">
            {title}
          </h2>
          <p className="mt-3 max-w-[60ch] text-base text-ink-2">{lede}</p>
        </div>
      </header>
      <div className="flex flex-col gap-12 sm:pl-16">{children}</div>
    </section>
  );
}

function Sub({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line pb-2">
        <h3 className="font-mono text-2xs tracking-wider text-ink-3 uppercase">{title}</h3>
        {note && <p className="text-xs text-ink-3">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <code className={cn("font-mono text-2xs text-ink-2", className)}>{children}</code>;
}

/* ------------------------------------------------------------------ */
/* 01 Principles                                                        */
/* ------------------------------------------------------------------ */

export function PrinciplesSection({ n }: { n: number }) {
  const rows: [string, string][] = [
    ["Speed first", "Add, complete and reschedule take one click or one key. Nothing stands between a thought and the list."],
    ["One primary action", "Each screen has one accent-colored action. Everything else waits on hover or focus."],
    ["Every state is designed", "Empty, loading, error and offline are written and drawn — not left to defaults."],
    ["Forgiving", "Undo instead of “Are you sure?”. Confirmation only when something can’t be brought back."],
    ["Motion explains", "Animation shows where a thing came from, where it went, or that an action landed. Otherwise it doesn’t move."],
    ["Readable everywhere", "Works at 200% zoom, on a 360px phone, with a keyboard alone, and with motion off."],
  ];
  return (
    <Section id="principles" n={n} title="Principles" lede="Six rules every screen is checked against. When two of them disagree, the earlier one wins.">
      <dl className="divide-y divide-line border-y border-line">
        {rows.map(([t, d]) => (
          <div key={t} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
            <dt className="font-display text-lg text-ink">{t}</dt>
            <dd className="text-sm text-ink-2 sm:pt-1">{d}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 02 Color                                                             */
/* ------------------------------------------------------------------ */

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

type Swatch = { token: string; role: string; on?: string; min?: number };

const COLOR_GROUPS: { title: string; note?: string; swatches: Swatch[] }[] = [
  {
    title: "Surfaces & lines",
    note: "Paper, not white. Depth comes from tone first, shadow second.",
    swatches: [
      { token: "bg", role: "Page" },
      { token: "surface", role: "Hovered rows, side panels" },
      { token: "raised", role: "Cards, inputs, overlays" },
      { token: "sunken", role: "Wells, tracks, skeletons" },
      { token: "line", role: "Hairline dividers (decorative)" },
      { token: "line-strong", role: "Emphasised dividers (decorative)" },
      { token: "control", role: "Control borders", on: "raised", min: 3 },
    ],
  },
  {
    title: "Ink",
    note: "Three levels of text. Ratios against page background.",
    swatches: [
      { token: "ink", role: "Primary text", on: "bg", min: 4.5 },
      { token: "ink-2", role: "Secondary text, metadata", on: "bg", min: 4.5 },
      { token: "ink-3", role: "Muted text, placeholders", on: "bg", min: 4.5 },
    ],
  },
  {
    title: "Accent — vermilion",
    note: "The editor’s pencil. Primary action, focus, links, the current place. Never decoration.",
    swatches: [
      { token: "accent", role: "Primary action, focus, links", on: "bg", min: 4.5 },
      { token: "accent-hover", role: "Pressed / hovered primary" },
      { token: "accent-ink", role: "Text on accent", on: "accent", min: 4.5 },
      { token: "accent-soft", role: "Selection, highlight wash" },
    ],
  },
  {
    title: "Status",
    note: "Always paired with an icon or words — never color alone.",
    swatches: [
      { token: "success", role: "Done, synced", on: "bg", min: 4.5 },
      { token: "success-soft", role: "Success wash" },
      { token: "warning", role: "Due soon, conflicts", on: "bg", min: 4.5 },
      { token: "warning-soft", role: "Warning wash" },
      { token: "danger", role: "Overdue, destructive", on: "bg", min: 4.5 },
      { token: "danger-soft", role: "Danger wash" },
    ],
  },
  {
    title: "Priority",
    note: "P1 shares danger’s hue on purpose: urgent should feel urgent.",
    swatches: [
      { token: "p1", role: "P1 · Urgent", on: "bg", min: 4.5 },
      { token: "p2", role: "P2 · High", on: "bg", min: 4.5 },
      { token: "p3", role: "P3 · Normal", on: "bg", min: 4.5 },
      { token: "p4", role: "P4 · Someday", on: "bg", min: 4.5 },
    ],
  },
];

function useTokenValues() {
  const { resolvedTheme } = usePreferences();
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    // Wait a frame: the provider sets data-theme in its own effect, which runs after ours.
    const raf = requestAnimationFrame(() => {
      const cs = getComputedStyle(document.documentElement);
      const all = COLOR_GROUPS.flatMap((g) => g.swatches.map((s) => s.token));
      setValues(Object.fromEntries([...all, "bg"].map((t) => [t, cs.getPropertyValue(`--c-${t}`).trim()])));
    });
    return () => cancelAnimationFrame(raf);
  }, [resolvedTheme]);
  return { values, theme: resolvedTheme };
}

export function ColorSection({ n }: { n: number }) {
  const { values, theme } = useTokenValues();
  return (
    <Section
      id="color"
      n={n}
      title="Color"
      lede={
        <>
          Warm paper and deep ink, with one confident accent. Every text pairing passes WCAG AA in both themes —
          the values below are read live from the <em>{theme}</em> theme, and <Mono>npm run contrast</Mono> fails the build if one slips.
        </>
      }
    >
      {COLOR_GROUPS.map((g) => (
        <Sub key={g.title} title={g.title} note={g.note}>
          <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {g.swatches.map((s) => {
              const hex = values[s.token];
              const ratio = s.on && hex && values[s.on] ? contrast(hex, values[s.on]) : null;
              return (
                <li key={s.token} className="flex items-center gap-4">
                  <span
                    className="size-11 shrink-0 rounded-md ring-1 ring-line ring-inset"
                    style={{ background: `var(--c-${s.token})` }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-ink">{s.token}</span>
                      <Mono className="text-ink-3">{hex || "—"}</Mono>
                    </div>
                    <p className="truncate text-xs text-ink-2">{s.role}</p>
                  </div>
                  {ratio !== null && (
                    <span
                      className={cn(
                        "font-mono text-2xs",
                        ratio >= (s.min ?? 4.5) ? "text-ink-2" : "font-medium text-danger",
                      )}
                      title={`Contrast on ${s.on}`}
                    >
                      {ratio.toFixed(1)}:1 {ratio >= (s.min ?? 4.5) ? (s.min === 3 ? "UI" : "AA") : "fail"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Sub>
      ))}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 03 Typography                                                        */
/* ------------------------------------------------------------------ */

const TYPE_ROWS: { token: string; spec: string; className: string; sample: string }[] = [
  { token: "display / 5xl", spec: "61 / 62 · −3%", className: "font-display text-5xl", sample: "Tuesday, quietly" },
  { token: "display / 4xl", spec: "49 / 52 · −2.5%", className: "font-display text-4xl", sample: "Plan the week" },
  { token: "display / 3xl", spec: "39 / 44 · −2%", className: "font-display text-3xl", sample: "Today" },
  { token: "display / 2xl", spec: "31 / 38 · −1.5%", className: "font-display text-2xl", sample: "Home renovation" },
  { token: "display / xl", spec: "25 / 32 · −1%", className: "font-display text-xl", sample: "Delete this project?" },
  { token: "sans / lg", spec: "20 / 28 · −0.5%", className: "text-lg font-medium", sample: "Renew passport before the Lisbon trip" },
  { token: "sans / base", spec: "16 / 24 · 0", className: "text-base", sample: "Call the plumber about the upstairs leak" },
  { token: "sans / sm", spec: "14 / 20 · 0", className: "text-sm", sample: "Moved 3 tasks to Tomorrow." },
  { token: "sans / xs", spec: "13 / 18 · +0.5%", className: "text-xs text-ink-2", sample: "Home · Repeats every 2 weeks" },
  { token: "mono / xs", spec: "13 / 18 · tabular", className: "font-mono text-xs", sample: "09:30 – 10:15  ·  Fri 24 Oct" },
  { token: "mono / 2xs", spec: "11 / 16 · +2%", className: "font-mono text-2xs text-ink-2", sample: "P1 · 3 OVERDUE · 12/40" },
];

export function TypeSection({ n }: { n: number }) {
  return (
    <Section
      id="type"
      n={n}
      title="Typography"
      lede="Three voices. Newsreader for headings — an editorial serif with optical sizing. Schibsted Grotesk for the interface, sturdy at 13px. IBM Plex Mono for anything you’d read on a clock."
    >
      <Sub title="Families">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            ["Newsreader", "Display", "font-display text-3xl", "Aa Gg 1–9"],
            ["Schibsted Grotesk", "Interface", "font-sans text-3xl font-medium", "Aa Gg 1–9"],
            ["IBM Plex Mono", "Times, dates, counts", "font-mono text-3xl", "Aa 09:30"],
          ].map(([name, use, cls, s]) => (
            <div key={name} className="border-t border-line-strong pt-3">
              <p className={cn(cls, "text-ink")}>{s}</p>
              <p className="mt-3 text-sm font-medium text-ink">{name}</p>
              <p className="text-xs text-ink-2">{use}</p>
            </div>
          ))}
        </div>
      </Sub>
      <Sub title="Scale" note="Major third (×1.25) from 16px. Tighter tracking as size grows.">
        <ul className="divide-y divide-line">
          {TYPE_ROWS.map((r) => (
            <li key={r.token} className="grid items-baseline gap-x-6 gap-y-1 py-4 sm:grid-cols-[9rem_1fr]">
              <div className="flex gap-3 sm:flex-col sm:gap-0">
                <Mono className="text-ink">{r.token}</Mono>
                <Mono className="text-ink-3">{r.spec}</Mono>
              </div>
              <p className={cn(r.className, "min-w-0 break-words text-ink")}>{r.sample}</p>
            </li>
          ))}
        </ul>
      </Sub>
      <Sub title="Rules">
        <ul className="grid gap-3 text-sm text-ink-2 sm:grid-cols-2">
          <li>Display face only at 25px and up. Never for buttons, labels, or body text.</li>
          <li>Italic display (<em className="font-display text-base text-ink">like this</em>) is the only emphasis in headings.</li>
          <li>All times, dates, durations and counters are mono with tabular figures, so they don’t jitter as they change.</li>
          <li>Body copy stays under 64 characters per line. UI text is sentence case — no Title Case, no ALL CAPS except mono labels.</li>
        </ul>
      </Sub>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 04 Spacing                                                           */
/* ------------------------------------------------------------------ */

const SPACE = [1, 2, 3, 4, 6, 8, 12, 16, 24];

export function SpacingSection({ n }: { n: number }) {
  return (
    <Section id="spacing" n={n} title="Spacing & layout" lede="A 4px base with an 8px rhythm. Half-steps (4, 12) are for tightening inside components; layout uses multiples of 8.">
      <Sub title="Scale" note="Tailwind step × 4px">
        <ul className="flex flex-col gap-2">
          {SPACE.map((s) => (
            <li key={s} className="grid grid-cols-[3rem_3.5rem_1fr] items-center gap-3">
              <Mono className="text-ink">{s}</Mono>
              <Mono className="text-ink-3">{s * 4}px</Mono>
              <span className="h-3 rounded-sm bg-accent-soft ring-1 ring-accent/30 ring-inset" style={{ width: s * 4 }} />
            </li>
          ))}
        </ul>
      </Sub>
      <Sub title="Layout">
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          {[
            ["Page gutter", "16px under 640px, 32px above"],
            ["Reading column", "Max 64ch for prose; lists run to 720px"],
            ["Row height", "48px minimum — every row is a full touch target"],
            ["Hit targets", "32px minimum on desktop, 44px on touch, extended with ::before where the visual is smaller"],
            ["Layout grid", "Left-aligned. Sidebar + content, never centered-everything"],
            ["Breakpoints", "360 · 640 · 768 · 1024 · 1280 — designed at 360 first"],
          ].map(([k, v]) => (
            <div key={k} className="border-t border-line pt-2">
              <dt className="font-medium text-ink">{k}</dt>
              <dd className="text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
      </Sub>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 05 Shape & elevation                                                 */
/* ------------------------------------------------------------------ */

export function ShapeSection({ n }: { n: number }) {
  return (
    <Section id="shape" n={n} title="Shape & elevation" lede="Two radii and circles. Three shadow levels, used only when something genuinely sits above the page.">
      <Sub title="Radius">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            ["sm · 4px", "rounded-sm", "Chips, badges, menu items, checkboxes, keys"],
            ["md · 8px", "rounded-md", "Buttons, inputs, cards, popovers, dialogs"],
            ["full", "rounded-full", "Task checkboxes, dots, avatars, switch thumbs"],
          ].map(([name, cls, use]) => (
            <div key={name}>
              <div className={cn("h-20 bg-raised ring-1 ring-line-strong ring-inset", cls, cls === "rounded-full" && "w-20")} />
              <p className="mt-3 text-sm font-medium text-ink">{name}</p>
              <p className="text-xs text-ink-2">{use}</p>
            </div>
          ))}
        </div>
      </Sub>
      <Sub title="Elevation" note="Shadows are warm-tinted in light, near-black with an inner highlight in dark.">
        <div className="grid gap-6 rounded-md bg-sunken p-6 sm:grid-cols-4">
          {[
            ["0 · flat", "", "Rows and sections. Separation by hairline."],
            ["1 · resting", "shadow-1", "Buttons, cards at rest"],
            ["2 · floating", "shadow-2", "Popovers, menus, hovered cards"],
            ["3 · overlay", "shadow-3", "Dialogs, dragged items, toasts"],
          ].map(([name, cls, use]) => (
            <div key={name}>
              <div className={cn("h-16 rounded-md bg-raised ring-1 ring-line ring-inset", cls)} />
              <p className="mt-3 text-sm font-medium text-ink">{name}</p>
              <p className="text-xs text-ink-2">{use}</p>
            </div>
          ))}
        </div>
      </Sub>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 06 Icons                                                             */
/* ------------------------------------------------------------------ */

const ICONS = [
  [Inbox, "Inbox"], [Sun, "Today"], [CalendarDays, "Upcoming"], [Hash, "Project"], [Tag, "Label"], [Flag, "Priority"],
  [Bell, "Reminder"], [Repeat, "Repeats"], [Clock, "Time"], [Timer, "Focus"], [Search, "Search"], [Plus, "Add"],
  [Check, "Done"], [Pencil, "Edit"], [Trash2, "Delete"], [Archive, "Archive"], [Users, "Shared"], [LayoutList, "List"],
] as const;

export function IconSection({ n }: { n: number }) {
  return (
    <Section id="icons" n={n} title="Iconography" lede="Lucide, at a fixed 1.5px stroke regardless of size. Icons label actions; they never replace words for anything ambiguous, and emoji are never UI.">
      <Sub title="Set" note="14 · 16 · 20 · 24px — 16px in rows and buttons, 20px in navigation">
        <ul className="grid grid-cols-3 gap-px overflow-hidden rounded-md bg-line ring-1 ring-line xs:grid-cols-4 sm:grid-cols-6">
          {ICONS.map(([I, name]) => (
            <li key={name} className="flex flex-col items-center gap-2 bg-bg py-5 text-ink">
              <Icon icon={I} size="md" />
              <span className="text-xs text-ink-2">{name}</span>
            </li>
          ))}
        </ul>
      </Sub>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 07 Components                                                        */
/* ------------------------------------------------------------------ */

export function ComponentsSection({ n }: { n: number }) {
  const [view, setView] = useState<"list" | "board" | "calendar">("list");
  const [checks, setChecks] = useState({ a: true, b: false });
  const [sw, setSw] = useState(true);
  const [taskChecks, setTaskChecks] = useState<Record<Priority, boolean>>({ 1: false, 2: false, 3: true, 4: false });

  return (
    <Section id="components" n={n} title="Components" lede="Built on Radix primitives in the shadcn pattern, restyled to these tokens. Press anything: everything that can be clicked answers with a small scale-down.">
      <Sub title="Buttons" note="One primary per screen.">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" magnetic>
              <Icon icon={Plus} /> Add task
            </Button>
            <Button>Schedule</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="danger">
              <Icon icon={Trash2} /> Delete
            </Button>
            <Button variant="link">View all</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Tooltip content="Search" shortcut={["/"]}>
              <Button size="icon" variant="ghost" aria-label="Search">
                <Icon icon={Search} />
              </Button>
            </Tooltip>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </Sub>

      <Sub title="Fields">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Task name" hint="Try “Pay rent every 1st at 9am p1”">
            {(p) => <Input placeholder="What needs doing?" {...p} />}
          </Field>
          <Field label="Project name" error="A project needs a name — even a short one.">
            {(p) => <Input defaultValue="" {...p} />}
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            {(p) => <Textarea placeholder="Links, details, the address…" {...p} />}
          </Field>
        </div>
      </Sub>

      <Sub title="Selection">
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 text-sm text-ink">
              <Checkbox checked={checks.a} onCheckedChange={(v) => setChecks((c) => ({ ...c, a: v === true }))} />
              Show completed tasks
            </label>
            <label className="flex items-center gap-3 text-sm text-ink">
              <Checkbox checked={checks.b} onCheckedChange={(v) => setChecks((c) => ({ ...c, b: v === true }))} />
              Start weeks on Monday
            </label>
            <label className="mt-2 flex items-center gap-3 text-sm text-ink">
              <Switch checked={sw} onCheckedChange={setSw} />
              Daily digest at 08:00
            </label>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              {([1, 2, 3, 4] as Priority[]).map((p) => (
                <TaskCheckbox
                  key={p}
                  priority={p}
                  checked={taskChecks[p]}
                  onCheckedChange={() => setTaskChecks((c) => ({ ...c, [p]: !c[p] }))}
                  aria-label={`P${p} task`}
                />
              ))}
              <span className="text-xs text-ink-3">Task checkbox, ringed by priority</span>
            </div>
            <Segmented
              label="View"
              value={view}
              onValueChange={setView}
              options={[
                { value: "list", label: "List" },
                { value: "board", label: "Board" },
                { value: "calendar", label: "Calendar" },
              ]}
            />
          </div>
        </div>
      </Sub>

      <Sub title="Badges, priority, keys">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Home</Badge>
            <Badge tone="accent">Shared</Badge>
            <Badge tone="success">
              <Icon icon={Check} size="xs" /> Synced
            </Badge>
            <Badge tone="warning">Due in 1h</Badge>
            <Badge tone="danger">2 overdue</Badge>
            <Badge tone="outline">
              <Dot className="bg-p3" /> Work
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            {([1, 2, 3, 4] as Priority[]).map((p) => (
              <PriorityFlag key={p} priority={p} showLabel />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Q</Kbd> quick add
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd> command
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>T</Kbd> today
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>⇧</Kbd>
              <Kbd>⌫</Kbd> delete
            </span>
          </div>
        </div>
      </Sub>

      <Sub title="Overlays" note="Each springs from its trigger and closes faster than it opens.">
        <div className="flex flex-wrap gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button>
                <Icon icon={CalendarClock} /> Reschedule
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-1.5">
              {[
                [Sun, "Today", "Fri"],
                [Sunrise, "Tomorrow", "Sat"],
                [CalendarDays, "Next week", "Mon 27"],
                [Moon, "Someday", ""],
              ].map(([I, label, hint]) => (
                <PopoverClose asChild key={label as string}>
                  <button
                    className="flex h-9 w-full items-center gap-2.5 rounded-sm px-2 text-sm text-ink hover:bg-sunken focus-visible:bg-sunken"
                    onClick={() => toast(`Moved to ${label}.`)}
                  >
                    <Icon icon={I as typeof Sun} className="text-ink-3" />
                    <span className="flex-1 text-left">{label as string}</span>
                    <span className="font-mono text-2xs text-ink-3">{hint as string}</span>
                  </button>
                </PopoverClose>
              ))}
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Task actions">
                <Icon icon={MoreHorizontal} /> Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Task</DropdownMenuLabel>
              <DropdownMenuItem icon={<Icon icon={Pencil} />} shortcut="E">Edit</DropdownMenuItem>
              <DropdownMenuItem icon={<Icon icon={Copy} />} shortcut="D">Duplicate</DropdownMenuItem>
              <DropdownMenuItem icon={<Icon icon={ChevronRight} />}>Move to…</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                tone="danger"
                icon={<Icon icon={Trash2} />}
                shortcut="⌫"
                onSelect={() => toastWithUndo("Deleted “Water the plants”.", () => toast("Restored."))}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="danger">Delete project…</Button>
            </DialogTrigger>
            <DialogContent
              title="Delete “Home renovation”?"
              description="Its 14 tasks and their history go with it. This can’t be undone — archive it instead if you might need it later."
            >
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Keep project</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>
                    <Icon icon={Archive} /> Archive
                  </Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger" onClick={() => toast("Deleted “Home renovation”.")}>
                    Delete forever
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button onClick={() => toastWithUndo("Completed “Book dentist”.", () => toast("Back on your list."))}>
            <Icon icon={Undo2} /> Toast with undo
          </Button>
        </div>
      </Sub>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 08 Task patterns                                                     */
/* ------------------------------------------------------------------ */

const SEED: TaskLite[] = [
  { id: "1", title: "Renew passport before the Lisbon trip", priority: 1, due: { label: "Yesterday", overdue: true }, project: { name: "Travel", color: "bg-p3" } },
  { id: "2", title: "Call the plumber about the upstairs leak", priority: 2, due: { label: "Today 14:00" }, project: { name: "Home", color: "bg-success" } },
  { id: "3", title: "Draft Q4 budget notes", priority: 3, due: { label: "Today" }, project: { name: "Work", color: "bg-accent" } },
  { id: "4", title: "Water the plants", priority: 4, due: { label: "Today" } },
];

function parseQuick(text: string): { title: string; priority: Priority } {
  const m = text.match(/(?:^|\s)p([1-4])(?=\s|$)/i);
  return {
    title: text.replace(/(?:^|\s)p[1-4](?=\s|$)/i, "").trim(),
    priority: (m ? Number(m[1]) : 4) as Priority,
  };
}

function TaskListDemo() {
  const [tasks, setTasks] = useState<TaskLite[]>(SEED);
  const [draft, setDraft] = useState("");
  const [burst, setBurst] = useState(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const toggle = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.done) {
      // Unchecked before it left: cancel the removal.
      clearTimeout(timers.current.get(id));
      setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: false } : x)));
      return;
    }
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: true } : x)));
    // Let the tick and strike land, then the row leaves and the list closes up.
    timers.current.set(
      id,
      setTimeout(() => {
        setTasks((ts) => {
          const next = ts.filter((x) => x.id !== id);
          if (next.length === 0) setBurst((b) => b + 1);
          return next;
        });
        toastWithUndo(`Completed “${t.title}”.`, () =>
          setTasks((ts) => [...ts, { ...t, done: false }].sort((a, b) => a.priority - b.priority)),
        );
      }, 520),
    );
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const { title, priority } = parseQuick(draft);
    if (!title) return;
    const task: TaskLite = { id: crypto.randomUUID(), title, priority, due: { label: "Today" } };
    // Insert at its sorted position, so it springs in where it belongs.
    setTasks((ts) => {
      const i = ts.findIndex((x) => x.priority > priority);
      return i === -1 ? [...ts, task] : [...ts.slice(0, i), task, ...ts.slice(i)];
    });
    setDraft("");
  };

  return (
    <div className="max-w-[720px]">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h4 className="font-display text-2xl text-ink">Today</h4>
        <span className="font-mono text-2xs text-ink-3">{tasks.filter((t) => !t.done).length} open</span>
      </div>
      <form onSubmit={add} className="mb-2 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task — end with p1 to make it urgent"
          aria-label="Add a task"
        />
        <Button type="submit" variant="primary" magnetic aria-label="Add task">
          <Icon icon={Plus} />
          <span className="max-xs:hidden">Add</span>
        </Button>
      </form>
      <div className="relative">
        <ul className="pl-0 sm:pl-6">
          <AnimatePresence mode="popLayout" initial={false}>
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggle} draggable />
            ))}
          </AnimatePresence>
        </ul>
        <AnimatePresence>
          {tasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.slow, ease: ease.enter, delay: 0.15 }}
              className="relative"
            >
              <EmptyState
                mark="Fin."
                title="Today is clear."
                body="Nothing else is due. Tomorrow has 3 tasks if you want a head start."
                action={
                  <Button size="sm" onClick={() => setTasks(SEED)}>
                    Reset the demo
                  </Button>
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="absolute top-16 left-8">
          <Burst trigger={burst} />
        </span>
      </div>
    </div>
  );
}

function ReorderDemo() {
  const [items, setItems] = useState(["Morning pages", "Inbox to zero", "Deep work: chapter 3", "Walk"]);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  return (
    <Reorder.Group axis="y" values={items} onReorder={setItems} className="flex max-w-[420px] flex-col gap-2">
      {items.map((it, i) => (
        <Reorder.Item
          key={it}
          value={it}
          tabIndex={0}
          data-cursor="drag"
          data-cursor-label="Drag"
          aria-label={`${it}. Alt plus arrow keys to move.`}
          onKeyDown={(e) => {
            if (!e.altKey) return;
            if (e.key === "ArrowUp") (e.preventDefault(), move(i, -1));
            if (e.key === "ArrowDown") (e.preventDefault(), move(i, 1));
          }}
          transition={spring.layout}
          whileDrag={{ scale: distance.lift, rotate: -distance.liftTilt, boxShadow: "var(--sh-3)", zIndex: 1 }}
          className="flex h-12 touch-none items-center gap-3 rounded-md bg-raised px-3 text-sm text-ink shadow-1 ring-1 ring-line ring-inset select-none"
        >
          <span className="font-mono text-2xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
          {it}
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}

export function TaskPatternsSection({ n }: { n: number }) {
  return (
    <Section
      id="tasks"
      n={n}
      title="Task patterns"
      lede="The core micro-interactions, live. Complete a task: the tick draws, a strike crosses the title, the row leaves and the list closes up. Add one with p1–p3 and it springs into its sorted place."
    >
      <Sub title="List — complete, add, undo" note="Clear the list to see the celebration (toggle it under Display).">
        <TaskListDemo />
      </Sub>
      <Sub title="Drag to reorder" note="Lifts, tilts, neighbors make room. Keyboard: focus a row, Alt + ↑/↓.">
        <ReorderDemo />
      </Sub>
      <Sub title="Board cards" note="A 3° perspective tilt toward the pointer — desktop with Full motion only.">
        <div className="grid gap-3 sm:grid-cols-3">
          {SEED.slice(0, 3).map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      </Sub>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 09 States                                                            */
/* ------------------------------------------------------------------ */

export function StatesSection({ n }: { n: number }) {
  return (
    <Section id="states" n={n} title="States" lede="Every list has four more faces than the happy path. Each is specific about what happened and what to do next.">
      <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
        <Sub title="Empty">
          <EmptyState
            title="No tasks in Inbox."
            body={
              <>
                Press <Kbd>Q</Kbd> anywhere to capture one. It lands here until you give it a day.
              </>
            }
            mark="¶"
            className="py-0"
          />
        </Sub>
        <Sub title="Loading" note="Skeletons in the shape of the content. No spinners.">
          <TaskRowSkeleton rows={4} />
        </Sub>
        <Sub title="Error">
          <ErrorState message="Couldn’t load Upcoming. Your tasks are safe — we just can’t reach them right now." onRetry={() => toast("Loaded.")} />
        </Sub>
        <Sub title="Offline">
          <OfflineBanner pending={3} />
        </Sub>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 10 Motion                                                            */
/* ------------------------------------------------------------------ */

function Track({ children }: { children: React.ReactNode }) {
  return <div className="relative h-6 rounded-sm bg-sunken pr-3">{children}</div>;
}

function Traveller({ at, transition }: { at: boolean; transition: object }) {
  return (
    <motion.div className="h-full w-full" initial={false} animate={{ x: at ? "100%" : "0%" }} transition={transition}>
      <span className="absolute top-1/2 left-0 block size-3 -translate-y-1/2 rounded-full bg-accent" />
    </motion.div>
  );
}

export function MotionSection({ n }: { n: number }) {
  const { motion: level } = usePreferences();
  const [at, setAt] = useState(false);
  const [play, setPlay] = useState(0);
  const run = () => {
    setAt((v) => !v);
    setPlay((p) => p + 1);
  };

  return (
    <Section
      id="motion"
      n={n}
      title="Motion"
      lede="Fast, small, and always for a reason: to show where something came from, where it went, or that an action landed. Only transform and opacity animate. Input is never blocked by an animation."
    >
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="primary" onClick={run}>
          Play all
        </Button>
        <span className="text-xs text-ink-3">
          Current level: <span className="font-mono text-ink-2">{level}</span>
          {level !== "full" && " — transforms are replaced with fades or skipped"}
        </span>
      </div>

      <Sub title="Durations">
        <ul className="flex flex-col gap-4">
          {(Object.keys(duration) as (keyof typeof duration)[]).map((k) => (
            <li key={k} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[7rem_1fr_14rem]">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-ink">{k}</span>
                <Mono className="text-ink-3">{duration[k] * 1000}ms</Mono>
              </div>
              <div className="h-2 overflow-hidden rounded-sm bg-sunken">
                <motion.div
                  key={play}
                  className="h-full origin-left bg-ink"
                  initial={{ scaleX: play ? 0 : 1 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: duration[k], ease: ease.enter }}
                />
              </div>
              <span className="text-xs text-ink-2">
                {{ fast: "Hover, press, tick, tooltip", base: "Popovers, toasts, row exit", slow: "Dialogs, reflow, drawers", page: "Route and view changes" }[k]}
              </span>
            </li>
          ))}
        </ul>
      </Sub>

      <Sub title="Easing">
        <ul className="flex flex-col gap-4">
          {(Object.keys(ease) as (keyof typeof ease)[]).map((k) => (
            <li key={k} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[7rem_1fr_14rem]">
              <div>
                <span className="text-sm font-medium text-ink">{k}</span>
                <Mono className="block text-ink-3">{ease[k].join(", ")}</Mono>
              </div>
              <Track>
                <Traveller at={at} transition={{ duration: duration.page * 1.6, ease: ease[k] }} />
              </Track>
              <span className="text-xs text-ink-2">
                {{ enter: "Things arriving", move: "Things moving across the screen", exit: "Things leaving — gets out of the way" }[k]}
              </span>
            </li>
          ))}
        </ul>
      </Sub>

      <Sub title="Springs" note="For anything the hand touches.">
        <ul className="flex flex-col gap-4">
          {(Object.keys(spring) as (keyof typeof spring)[]).map((k) => (
            <li key={k} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[7rem_1fr_14rem]">
              <div>
                <span className="text-sm font-medium text-ink">{k}</span>
                <Mono className="block text-ink-3">
                  k{spring[k].stiffness} c{spring[k].damping} m{spring[k].mass}
                </Mono>
              </div>
              <Track>
                <Traveller at={at} transition={spring[k]} />
              </Track>
              <span className="text-xs text-ink-2">
                {{ snappy: "Press, toggle, checkbox", pop: "Items entering, overlays", layout: "Reflow, reorder (FLIP)", follow: "Drag, cursor ring, tilt" }[k]}
              </span>
            </li>
          ))}
        </ul>
      </Sub>

      <Sub title="Guardrails">
        <ul className="grid gap-x-8 gap-y-3 text-sm text-ink-2 sm:grid-cols-2">
          <li>OS “reduce motion” clamps Full to Reduced. Display → Motion offers Full, Reduced, and Off.</li>
          <li>Reduced: fades stay, movement and scale go. Off: nothing animates, at all.</li>
          <li>Only <Mono>transform</Mono> and <Mono>opacity</Mono>. No animating width, height, top or left.</li>
          <li>Interruptible: clicking during an animation acts immediately; springs retarget mid-flight.</li>
          <li>Exits are faster than entrances (fast vs slow), so the next thing is never waiting.</li>
          <li>No idle or ambient animation inside the app. Nothing moves unless you did something.</li>
        </ul>
      </Sub>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 11 Cursor                                                            */
/* ------------------------------------------------------------------ */

export function CursorSection({ n }: { n: number }) {
  const { prefs, motion: level } = usePreferences();
  return (
    <Section
      id="cursor"
      n={n}
      title="Cursor"
      lede="On desktop, a small dot with a softly trailing ring. It tells you what a thing will do before you press it. It steps aside wherever precision matters, and disappears entirely on touch, with reduced motion, or when turned off."
    >
      <p className="-mt-6 text-xs text-ink-3">
        Status: {prefs.cursor ? (level === "full" ? "on (if you’re using a mouse or trackpad)" : `off — motion is ${level}`) : "off in Display settings"}
      </p>
      <div className="grid gap-px overflow-hidden rounded-md bg-line ring-1 ring-line sm:grid-cols-3">
        <CursorZone title="Clickable" note="Ring grows, dot hides">
          <Button>Hover me</Button>
        </CursorZone>
        <CursorZone title="Magnetic" note="Primary actions pull gently">
          <Button variant="primary" magnetic>
            <Icon icon={Plus} /> Add task
          </Button>
        </CursorZone>
        <CursorZone title="Draggable" note="Dashed ring; tightens while held">
          <span
            data-cursor="drag"
            data-cursor-label="Drag"
            className="inline-flex h-10 items-center rounded-md bg-raised px-4 text-sm text-ink shadow-1 ring-1 ring-line ring-inset select-none"
          >
            Water the plants
          </span>
        </CursorZone>
        <CursorZone title="Labelled" note="A word where the action isn’t obvious">
          <span
            data-cursor="pointer"
            data-cursor-label="Open"
            className="font-display text-xl text-ink underline decoration-line-strong underline-offset-4"
          >
            Home renovation
          </span>
        </CursorZone>
        <CursorZone title="Native in text" note="Your OS cursor, for precision">
          <Input placeholder="Type here" aria-label="Cursor test field" />
        </CursorZone>
        <CursorZone title="Over the accent" note="Difference blend keeps it visible">
          <div className="grid h-10 w-full place-items-center rounded-md bg-accent text-sm font-medium text-accent-ink">
            Accent surface
          </div>
        </CursorZone>
      </div>
      <div data-cursor="native" className="rounded-md ring-1 ring-line">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md bg-line text-center">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="bg-surface py-1.5 font-mono text-2xs text-ink-3">
              {d}
            </div>
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="h-12 bg-bg p-1 text-left font-mono text-2xs text-ink-2 sm:h-16">
              {i + 20 > 31 ? i - 11 : i + 20}
            </div>
          ))}
        </div>
        <p className="border-t border-line px-3 py-2 text-xs text-ink-3">Calendar grid: native cursor, so you can hit a 15-minute slot exactly.</p>
      </div>
    </Section>
  );
}

function CursorZone({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-40 flex-col justify-between gap-4 bg-bg p-5">
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-3">{note}</p>
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 12 Voice                                                             */
/* ------------------------------------------------------------------ */

export function VoiceSection({ n }: { n: number }) {
  const pairs: [string, string, string][] = [
    ["Buttons", "Add task", "Create new item"],
    ["Success", "Moved 3 tasks to Tomorrow. Undo", "Success! Your tasks have been updated 🎉"],
    ["Errors", "Couldn’t save — you’re offline. We’ll retry when you’re back.", "An error occurred. Please try again later."],
    ["Empty", "Nothing due today. Tomorrow has 3.", "You’re all caught up! Time to relax 🌴"],
    ["Confirm", "Delete “Home renovation” and its 14 tasks? This can’t be undone.", "Are you sure?"],
    ["Marketing", "Capture a task in one line. Margin handles the date.", "Supercharge your productivity 🚀"],
  ];
  return (
    <Section id="voice" n={n} title="Voice" lede="Short, specific, human. Name the thing, say what happened, offer the next step. No exclamation marks, no emoji, no hype.">
      <ul className="divide-y divide-line border-y border-line">
        {pairs.map(([where, yes, no]) => (
          <li key={where} className="grid gap-x-6 gap-y-2 py-4 sm:grid-cols-[7rem_1fr_1fr]">
            <span className="font-mono text-2xs tracking-wider text-ink-3 uppercase sm:pt-0.5">{where}</span>
            <p className="flex gap-2 text-sm text-ink">
              <Icon icon={Check} className="mt-0.5 text-success" label="Do" />
              {yes}
            </p>
            <p className="flex gap-2 text-sm text-ink-3 line-through decoration-ink-3/50">
              <span className="mt-0.5 w-4 shrink-0 text-center font-mono text-xs text-danger no-underline" aria-label="Don't">
                ×
              </span>
              {no}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
