"use client";

import { motion } from "motion/react";
import { duration, ease } from "@/design/motion";

export function ViewHeader({
  title,
  sub,
  actions,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.slow, ease: ease.enter }}
      className="mb-8 flex flex-wrap items-end gap-x-4 gap-y-2"
    >
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1.5 font-mono text-2xs text-ink-3">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </motion.header>
  );
}
