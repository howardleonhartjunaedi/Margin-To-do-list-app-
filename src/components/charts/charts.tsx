"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { animate, motion, useInView } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { usePreferences } from "@/components/providers/preferences";
import { Icon } from "@/components/ui/icon";
import { duration, ease } from "@/design/motion";
import { cn } from "@/lib/cn";
import { compact, niceMax } from "@/lib/stats";
import { m } from "@/i18n/catalogs";

/*
 * Charts follow one spec: thin marks (≤24px), 4px rounded data-end with a square baseline,
 * 2px gaps, hairline solid gridlines, text in text tokens (never the series color),
 * single series = no legend. They draw in once when scrolled into view; every value is
 * reachable by hover, keyboard focus, or the table view.
 */

export interface Datum {
  key: string;
  label: string; // tooltip / table: "Mon 12 Oct"
  short: string; // axis: "12"
  value: number;
  highlight?: boolean;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const roundedTop = (x: number, y: number, w: number, h: number, r = 4) => {
  const base = y + h;
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${base}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${base}Z`;
};

/** Vertical columns from one baseline. One series; the highlighted column (e.g. today) wears the accent. */
export function ColumnChart({
  data,
  format,
  height = 180,
  label,
}: {
  data: Datum[];
  format: (v: number) => string;
  height?: number;
  label: string;
}) {
  const [box, width] = useWidth<HTMLDivElement>();
  const inView = useInView(box, { once: true, margin: "-40px" });
  const { motion: level } = usePreferences();
  const [active, setActive] = useState<number | null>(null);
  const id = useId();

  const M = { top: 8, right: 4, bottom: 22, left: 32 };
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => M.top + plotH - (v / max) * plotH;
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 44))));
  // Whole-number ticks only: a midpoint of 0.5 would read as "1" twice.
  const ticks = Number.isInteger(max / 2) ? [0, max / 2, max] : [0, max];
  const draw = inView && level === "full";

  return (
    <div ref={box} className="relative" onPointerLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--c-line)" strokeWidth={1} />
              <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 font-mono text-2xs">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = M.left + i * band + (band - barW) / 2;
            const h = (d.value / max) * plotH;
            return (
              <g key={d.key}>
                <motion.path
                  d={roundedTop(x, y(d.value), barW, h)}
                  fill={d.highlight ? "var(--c-accent)" : "var(--c-ink-3)"}
                  opacity={active === null || active === i ? 1 : 0.55}
                  style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
                  initial={level === "full" ? { scaleY: 0 } : false}
                  animate={draw || level !== "full" ? { scaleY: 1 } : { scaleY: 0 }}
                  transition={{ duration: duration.slow * 1.5, ease: ease.enter, delay: Math.min(i * 0.012, 0.4) }}
                />
                {i % every === 0 && (
                  <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="fill-ink-3 font-mono text-2xs">
                    {d.short}
                  </text>
                )}
                {/* Hit target: the whole band, taller than the mark */}
                <rect
                  x={M.left + i * band}
                  y={M.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.label}: ${format(d.value)}`}
                  aria-describedby={active === i ? `${id}-tip` : undefined}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none focus-visible:stroke-focus focus-visible:stroke-2"
                />
              </g>
            );
          })}
        </svg>
      )}
      {active !== null && data[active] && (
        <div
          id={`${id}-tip`}
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm bg-ink px-2 py-1 text-xs whitespace-nowrap text-bg shadow-2"
          style={{ left: M.left + active * band + band / 2, top: y(data[active].value) - 6 }}
        >
          <span className="font-medium">{format(data[active].value)}</span>
          <span className="ml-1.5 text-bg/70">{data[active].label}</span>
        </div>
      )}
    </div>
  );
}

/** Horizontal bars, one row per category; identity is the label (and its dot), never color alone. */
export function BarList({ rows, format }: { rows: { key: string; label: string; dot?: string; value: number }[]; format: (v: number) => string }) {
  const ref = useRef<HTMLUListElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const { motion: level } = usePreferences();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul ref={ref} className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm" tabIndex={0} aria-label={`${r.label}: ${format(r.value)}`}>
          <span className="flex min-w-0 items-center gap-2 text-ink-2">
            {r.dot && <span className={cn("size-2 shrink-0 rounded-full", r.dot)} />}
            <span className="truncate">{r.label}</span>
          </span>
          <span className="h-2.5 rounded-r-sm" aria-hidden>
            <motion.span
              className="block h-full rounded-r-sm bg-ink-3"
              style={{ width: `${(r.value / max) * 100}%`, transformOrigin: "0 50%" }}
              initial={level === "full" ? { scaleX: 0 } : false}
              animate={inView || level !== "full" ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ duration: duration.slow * 1.5, ease: ease.enter, delay: i * 0.04 }}
            />
          </span>
          <span className="font-mono text-xs text-ink tabular-nums">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Animates 0 → value once visible. Proportional figures for big standalone numbers. */
export function CountUp({ value, format = (v) => compact(v) }: { value: number; format?: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const { motion: level } = usePreferences();
  const [shown, setShown] = useState(level === "full" ? 0 : value);
  useEffect(() => {
    if (level !== "full") return setShown(value);
    if (!inView) return;
    const c = animate(0, value, { duration: duration.page * 2, ease: ease.enter, onUpdate: (v) => setShown(v) });
    return () => c.stop();
  }, [inView, value, level]);
  return (
    <span ref={ref}>
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

export function StatTile({
  label,
  value,
  format,
  delta,
  goodWhenUp = true,
  hero,
  note,
}: {
  label: string;
  value: number;
  format?: (v: number) => string;
  delta?: number | null;
  goodWhenUp?: boolean;
  hero?: boolean;
  note?: string;
}) {
  const good = delta != null && (delta >= 0) === goodWhenUp;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-ink-2">{label}</p>
      <p className={cn("font-sans font-semibold tracking-tight text-ink", hero ? "text-5xl" : "text-3xl")}>
        <CountUp value={value} format={format} />
      </p>
      {delta != null ? (
        <p className={cn("inline-flex items-center gap-1 text-xs", good ? "text-success" : "text-danger")}>
          <Icon icon={delta >= 0 ? TrendingUp : TrendingDown} size="xs" />
          {delta > 0 ? "+" : ""}
          {delta}% <span className="text-ink-3">{m().stats.vsPrevious}</span>
        </p>
      ) : (
        note && <p className="text-xs text-ink-3">{note}</p>
      )}
    </div>
  );
}

export function DataTable({ caption, rows, valueLabel }: { caption: string; rows: { label: string; value: string }[]; valueLabel: string }) {
  return (
    <div className="max-h-72 overflow-y-auto" data-lenis-prevent>
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            <th className="py-1.5 font-normal">{m().stats.period}</th>
            <th className="py-1.5 text-right font-normal">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line/60">
              <td className="py-1.5 text-ink-2">{r.label}</td>
              <td className="py-1.5 text-right font-mono text-xs text-ink tabular-nums">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
