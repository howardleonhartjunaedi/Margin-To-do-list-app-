"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { duration, ease } from "@/design/motion";
import { usePreferences } from "../providers/preferences";

const COUNT = 12;

/**
 * A small particle burst for clearing Today. Confirms a meaningful moment, then gets out of the way.
 * Renders nothing when the setting is off or motion isn't Full.
 */
export function Burst({ trigger }: { trigger: number }) {
  const { prefs, motion: level } = usePreferences();
  const particles = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const angle = (i / COUNT) * Math.PI * 2 + (trigger % 7) * 0.3;
        const dist = 28 + ((i * 37 + trigger * 13) % 22);
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, accent: i % 3 === 0, size: i % 2 ? 4 : 3 };
      }),
    [trigger],
  );

  if (!trigger || !prefs.celebrate || level !== "full") return null;

  return (
    <span key={trigger} aria-hidden className="pointer-events-none absolute top-1/2 left-1/2">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className={p.accent ? "absolute rounded-full bg-accent" : "absolute rounded-full bg-ink-3"}
          style={{ width: p.size, height: p.size }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4 }}
          transition={{ duration: duration.page * 1.4, ease: ease.enter }}
        />
      ))}
    </span>
  );
}
