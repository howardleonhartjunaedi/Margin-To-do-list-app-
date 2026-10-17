"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect } from "react";
import { usePreferences } from "./providers/preferences";

/**
 * Lenis smooth scrolling, driven by the GSAP ticker so ScrollTrigger stays in lockstep.
 * Mount on the landing page and long reading pages only — never inside the app shell.
 *
 * Safe by construction:
 * - native scroll position (find-in-page, keyboard, scroll restoration all keep working)
 * - `data-lenis-prevent` on any nested scroller (lists, modals, popovers) opts it out
 * - anchor links are handled by Lenis so they ease to the target
 * - off entirely unless motion is Full
 */
export function SmoothScroll() {
  const { motion } = usePreferences();

  useEffect(() => {
    if (motion !== "full") return;
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      lerp: 0.12,
      anchors: { offset: -24 },
      allowNestedScroll: true,
      prevent: (node) => node.closest?.("[data-lenis-prevent],[role=dialog],[role=listbox],[role=menu]") != null,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [motion]);

  return null;
}
