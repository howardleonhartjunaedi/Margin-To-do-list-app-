"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePreferences } from "@/components/providers/preferences";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { duration, ease } from "@/design/motion";
import type { SceneInputs } from "./hero-scene";

// The 3D scene is its own chunk, fetched only when the device should run it.
const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false });

function canRun3D() {
  try {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    if (nav.connection?.saveData) return false;
    // Phones and small windows: the scene sits below the fold there, so the poster does the job.
    if (!matchMedia("(min-width: 1024px) and (pointer: fine)").matches) return false;
    if ((nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2) return false; // low-power devices keep the poster
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function Hero() {
  const { motion: level } = usePreferences();
  const [load3D, setLoad3D] = useState(false);
  const [ready, setReady] = useState(false);
  const pointer = useRef({ x: 0, y: 0 });
  const progress = useRef(0);
  const section = useRef<HTMLElement>(null);
  const inputs = useRef<SceneInputs>({ pointer, progress }).current;

  useEffect(() => {
    if (level !== "full" || !canRun3D()) return;
    // After the page has loaded and the browser is idle: the headline and poster stay the LCP.
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(() => setLoad3D(true), { timeout: 3000 });
      else timer = setTimeout(() => setLoad3D(true), 1200); // Safari
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => {
      window.removeEventListener("load", go);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, [level]);

  useEffect(() => {
    if (!load3D) return;
    const move = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 };
    };
    const scroll = () => {
      const h = section.current?.offsetHeight ?? innerHeight;
      progress.current = Math.min(1, Math.max(0, scrollY / (h * 0.8)));
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    scroll();
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", scroll);
    };
  }, [load3D]);

  return (
    <section ref={section} aria-labelledby="hero-h" className="relative mx-auto grid max-w-6xl items-center overflow-x-clip gap-10 px-4 pt-12 pb-20 sm:px-8 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.05fr_1fr] lg:pt-0">
      <div>
        <h1 id="hero-h" className="font-display text-4xl text-balance text-ink sm:text-5xl">
          Write it down. <span className="block">
            <em className="whitespace-nowrap text-accent">Get on</em> with your day.
          </span>
        </h1>
        <p className="mt-6 max-w-[44ch] text-lg text-ink-2">
          Type a task the way you’d say it — <span className="font-mono text-base text-ink">dentist fri 3pm</span> — and Margin files it under the right day,
          reminds you at the right moment, and keeps everything else quiet.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button asChild variant="primary" size="lg" magnetic>
            <Link href="/sign-up">
              Start a list — it’s free <Icon icon={ArrowRight} />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <a href="#try">
              Try it right here <Icon icon={ArrowDown} />
            </a>
          </Button>
        </div>
      </div>

      <div className="relative aspect-[5/4] w-full max-lg:max-w-xl" aria-hidden>
        {/* Poster: the same composition, drawn in SVG. It's what you see first, and what stays on low-power devices. */}
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: ready ? 0 : 1 }}
          transition={{ duration: duration.slow, ease: ease.enter }}
        >
          <Poster />
        </motion.div>
        {load3D && (
          // The canvas bleeds past the layout box so tilting never cuts the scene at an edge;
          // the camera sits further back to keep the same apparent size.
          <motion.div
            className="pointer-events-none absolute -inset-[15%]"
            data-cursor="native"
            initial={{ opacity: 0 }}
            animate={{ opacity: ready ? 1 : 0 }}
            transition={{ duration: duration.page, ease: ease.enter }}
          >
            <HeroScene inputs={inputs} onReady={() => setReady(true)} />
          </motion.div>
        )}
      </div>
    </section>
  );
}

function Poster() {
  const cards = [
    { y: 70, x: 70, ring: "var(--c-p1)", w: [170, 100], done: false },
    { y: 125, x: 85, ring: "var(--c-p2)", w: [140, 80], done: false },
    { y: 180, x: 100, ring: "var(--c-accent)", w: [190, 110], done: true },
    { y: 235, x: 115, ring: "var(--c-p3)", w: [120, 90], done: false },
  ];
  return (
    <svg viewBox="0 0 500 400" className="size-full">
      <ellipse cx="250" cy="352" rx="190" ry="14" fill="var(--c-ink)" opacity="0.07" />
      {cards
        .slice()
        .reverse()
        .map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${-3 + i * 1.6})`}>
            <rect width="300" height="88" rx="8" fill="var(--c-raised)" stroke="var(--c-line)" />
            {c.done ? <circle cx="34" cy="38" r="11" fill={c.ring} /> : <circle cx="34" cy="38" r="10" fill="none" stroke={c.ring} strokeWidth="2.5" />}
            <rect x="58" y="32" width={c.w[0]} height="10" rx="3" fill={c.done ? "var(--c-ink-3)" : "var(--c-ink)"} opacity="0.85" />
            {c.done && <rect x="56" y="36.5" width={c.w[0] + 4} height="1.6" fill="var(--c-ink)" />}
            <rect x="58" y="54" width={c.w[1]} height="7" rx="3" fill="var(--c-ink-3)" opacity="0.55" />
          </g>
        ))}
      <g transform="translate(400 300)">
        <circle r="56" fill="var(--c-ink)" />
        <circle r="49" fill="var(--c-raised)" />
        <line x1="0" y1="0" x2="0" y2="-22" stroke="var(--c-ink)" strokeWidth="4" strokeLinecap="round" transform="rotate(300)" />
        <line x1="0" y1="0" x2="0" y2="-36" stroke="var(--c-accent)" strokeWidth="2.5" strokeLinecap="round" transform="rotate(60)" />
        <circle r="3.5" fill="var(--c-accent)" />
      </g>
    </svg>
  );
}
