"use client";

import { useEffect } from "react";
import { useAfterLoad } from "./deferred-chrome";
import { usePreferences } from "./providers/preferences";

/**
 * Lenis smooth scrolling, driven by the GSAP ticker so ScrollTrigger stays in lockstep.
 * Mount on the landing page and long reading pages only — never inside the app shell.
 *
 * Safe by construction:
 * - native scroll position (find-in-page, keyboard, scroll restoration all keep working)
 * - `data-lenis-prevent` on any nested scroller (lists, modals, popovers) opts it out
 * - anchor links are handled by Lenis so they ease to the target, clear of a sticky header
 * - off entirely unless motion is Full, and on touch screens (their own scrolling is better)
 * - fetched once the page has loaded, so it never competes with the first paint
 */
export function SmoothScroll() {
  const { motion } = usePreferences();
  const loaded = useAfterLoad();

  useEffect(() => {
    if (!loaded || motion !== "full" || matchMedia("(pointer: coarse)").matches) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("lenis")]).then(([{ default: gsap }, { ScrollTrigger }, { default: Lenis }]) => {
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({
        lerp: 0.12,
        anchors: { offset: -72 },
        allowNestedScroll: true,
        prevent: (node) => node.closest?.("[data-lenis-prevent],[role=dialog],[role=listbox],[role=menu]") != null,
      });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      cleanup = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [motion, loaded]);

  return null;
}
