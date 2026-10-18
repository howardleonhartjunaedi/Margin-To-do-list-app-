"use client";

import { CalendarDays, Columns3, GanttChart, Grid2x2, List } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/segmented";
import { Tooltip } from "@/components/ui/tooltip";
import { duration, ease } from "@/design/motion";
import { canViewTransition, useUrlParam } from "@/lib/view-transition";
import { useT } from "@/i18n/client";

export type Layout = "list" | "board" | "calendar" | "timeline" | "matrix";

export const LAYOUTS: Record<Layout, { icon: typeof List; key: string }> = {
  list: { icon: List, key: "L" },
  board: { icon: Columns3, key: "B" },
  calendar: { icon: CalendarDays, key: "C" },
  timeline: { icon: GanttChart, key: "T" },
  matrix: { icon: Grid2x2, key: "M" },
};

export function useLayout(available: Layout[]) {
  const [raw, set] = useUrlParam("layout", available[0]);
  const layout = (available.includes(raw as Layout) ? raw : available[0]) as Layout;
  return [layout, (l: Layout) => set(l, { transition: true })] as const;
}

export function LayoutSwitcher({ value, onChange, available }: { value: Layout; onChange: (l: Layout) => void; available: Layout[] }) {
  const t = useT().layout;
  if (available.length < 2) return null;
  return (
    <Segmented<Layout>
      label={t.layout}
      size="sm"
      value={value}
      onValueChange={onChange}
      options={available.map((l) => ({
        value: l,
        title: t.shortcut(t.names[l], LAYOUTS[l].key),
        label: (
          <Tooltip content={t.names[l]} shortcut={["V", LAYOUTS[l].key]}>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={LAYOUTS[l].icon} size="xs" />
              <span className="max-sm:sr-only">{t.names[l]}</span>
            </span>
          </Tooltip>
        ),
      }))}
    />
  );
}

/**
 * The swappable body. With the View Transitions API the browser morphs between
 * layouts (named "view-body"); without it, Motion crossfades with the same depth cue.
 */
export function LayoutBody({ layout, children }: { layout: Layout; children: React.ReactNode }) {
  // Animate only on a switch, never on first paint; and never twice (VT already did it).
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const animate = mounted.current && !canViewTransition();
  return (
    <motion.div
      key={layout}
      style={{ viewTransitionName: "view-body" }}
      initial={animate ? { opacity: 0, scale: 1.012, y: 4 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: duration.page, ease: ease.enter }}
    >
      {children}
    </motion.div>
  );
}
