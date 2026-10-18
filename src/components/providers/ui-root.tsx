"use client";

import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePreferences } from "./preferences";

/**
 * Providers for interactive UI: the in-app motion setting for every Motion animation, and
 * shared tooltip timing. Mounted by the layouts that need them (app, auth, styleguide, invite)
 * and by the landing page's lazily loaded sections — not at the root, so the landing page's
 * first paint doesn't wait on the animation or popover libraries.
 *   motion "reduced": Motion keeps opacity fades but drops transform/layout animation.
 *   motion "off": everything completes instantly.
 */
export function UiRoot({ children }: { children: React.ReactNode }) {
  const { motion } = usePreferences();
  return (
    <MotionConfig reducedMotion={motion === "full" ? "never" : "always"} transition={motion === "off" ? { duration: 0 } : undefined}>
      <TooltipProvider>{children}</TooltipProvider>
    </MotionConfig>
  );
}
