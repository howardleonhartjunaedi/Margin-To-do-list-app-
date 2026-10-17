"use client";

import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";
import { Bell, CalendarDays, Flag, Hash } from "lucide-react";
import { useEffect, useRef } from "react";
import { usePreferences } from "@/components/providers/preferences";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/*
 * The feature story. On wide screens with Full motion the section pins, and scrolling
 * moves a camera through four scenes laid out in depth (CSS 3D, transform + opacity only),
 * while the matching step of the text comes forward. Everywhere else the same four scenes
 * simply stack — same content, no choreography.
 */

const STEPS = [
  { n: "01", title: "Say it the way you’d say it.", body: "Dates, times, priority, project and repeats come straight out of the sentence. No forms." },
  { n: "02", title: "Reminded at the right moment.", body: "On your phone, your desktop or your inbox — and held until morning if it falls in your quiet hours." },
  { n: "03", title: "Your week, at a glance.", body: "Drag a task to another day. Everything with a date lands on the calendar where you can see it." },
  { n: "04", title: "Notice what’s working.", body: "What you finish, when you’re focused, which projects move. Quietly, without a leaderboard." },
];

const SENTENCE = "Call the plumber tomorrow 2pm p1 #home";
const MARKS: [number, number, string][] = [
  [17, 30, "bg-accent-soft"], // "tomorrow 2pm"
  [31, 33, "bg-warning-soft"], // "p1"
  [34, 39, "bg-sunken ring-1 ring-line-strong ring-inset"], // "#home"
];

function SceneQuickAdd() {
  return (
    <div className="w-full max-w-md rounded-md bg-raised p-5 shadow-2 ring-1 ring-line">
      <p className="font-mono text-2xs tracking-wider text-ink-3 uppercase">Quick add</p>
      <p className="mt-3 min-h-8 text-lg text-ink" data-typed>
        <span data-typed-text>{SENTENCE}</span>
        <span className="ml-0.5 inline-block h-5 w-px translate-y-1 bg-ink" data-caret />
      </p>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {[
          [CalendarDays, "Tomorrow"],
          [Bell, "14:00"],
          [Flag, "P1"],
          [Hash, "Home"],
        ].map(([I, t]) => (
          <li key={t as string} data-chip className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-sunken px-2 text-xs text-ink">
            <Icon icon={I as typeof Bell} size="xs" className="text-ink-3" />
            {t as string}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SceneReminder() {
  return (
    <div className="w-full max-w-sm">
      <p className="mb-3 text-center font-mono text-3xl text-ink-3" data-clock>
        13:45
      </p>
      <div data-notice className="rounded-md bg-ink p-4 text-bg shadow-3">
        <div className="flex items-center gap-2 text-xs text-bg/70">
          <Icon icon={Bell} size="xs" /> Margin · now
        </div>
        <p className="mt-2 text-base font-medium">Call the plumber</p>
        <p className="text-sm text-bg/75">Due Today 14:00</p>
        <div className="mt-3 flex gap-4 text-sm">
          <span className="font-medium underline decoration-bg/40 underline-offset-4">Done</span>
          <span className="text-bg/75">Snooze 10 min</span>
        </div>
      </div>
    </div>
  );
}

function SceneCalendar() {
  const days = Array.from({ length: 21 }, (_, i) => i + 12);
  return (
    <div className="w-full max-w-md rounded-md bg-raised p-4 shadow-2 ring-1 ring-line">
      <p className="mb-3 font-display text-lg text-ink">October</p>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-sm bg-line">
        {days.map((d) => (
          <div key={d} className="relative h-12 bg-bg p-1 font-mono text-2xs text-ink-3">
            {d}
            {d === 21 && (
              <span data-chip-drop className="absolute inset-x-1 bottom-1 truncate rounded-sm bg-accent-soft px-1 text-2xs text-ink">
                Plumber
              </span>
            )}
            {d === 15 && <span className="absolute inset-x-1 bottom-1 truncate rounded-sm bg-sunken px-1 text-2xs text-ink-2">Budget</span>}
            {d === 24 && <span className="absolute inset-x-1 bottom-1 truncate rounded-sm bg-sunken px-1 text-2xs text-ink-2">Flights</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneStats() {
  const bars = [3, 5, 2, 6, 4, 7, 5];
  return (
    <div className="w-full max-w-md rounded-md bg-raised p-5 shadow-2 ring-1 ring-line">
      <p className="text-xs text-ink-2">Done this week</p>
      <p className="font-sans text-5xl font-semibold tracking-tight text-ink" data-count>
        32
      </p>
      <div className="mt-4 flex h-28 items-end gap-2" role="img" aria-label="Tasks done per day this week: 3, 5, 2, 6, 4, 7, 5">
        {bars.map((b, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div data-bar className={cn("w-full max-w-6 origin-bottom rounded-t-sm", i === 5 ? "bg-accent" : "bg-ink-3")} style={{ height: `${(b / 7) * 85}%` }} />
            <span className="font-mono text-2xs text-ink-3">{"MTWTFSS"[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SCENES = [SceneQuickAdd, SceneReminder, SceneCalendar, SceneStats];

export function Story() {
  const root = useRef<HTMLElement>(null);
  const { motion: level } = usePreferences();

  useEffect(() => {
    if (level !== "full" || !root.current) return;
    // GSAP is fetched only once the screen is wide enough for the pinned version.
    const wide = matchMedia("(min-width: 1024px)");
    let mm: gsap.MatchMedia | undefined;
    let cancelled = false;
    const start = () => {
      wide.removeEventListener("change", start);
      void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ default: g }, { ScrollTrigger }]) => {
        if (!cancelled) mm = build(g, ScrollTrigger);
      });
    };
    if (wide.matches) start();
    else wide.addEventListener("change", start);
    return () => {
      cancelled = true;
      wide.removeEventListener("change", start);
      mm?.revert();
    };
  }, [level]);

  function build(gsap: GSAP, ScrollTrigger: typeof ScrollTriggerType) {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px)", () => {
      if (!root.current) return;
      const el = root.current;
      const q = gsap.utils.selector(el);
      const scenes = q("[data-scene]");
      const steps = q("[data-step]");
      const typed = el.querySelector<HTMLElement>("[data-typed-text]")!;
      const state = { chars: 0 };

      // Lay scenes out in depth; the "camera" (the world group) travels toward them.
      gsap.set(scenes, { position: "absolute", inset: 0, opacity: (i: number) => (i === 0 ? 1 : 0), z: (i: number) => -i * 700 });
      gsap.set(steps, { scaleY: (i: number) => (i === 0 ? 1 : 0) });
      gsap.set(q("[data-chip]"), { opacity: 0, scale: 0.85, y: 6 });
      gsap.set(q("[data-notice]"), { y: -40, opacity: 0 });
      gsap.set(q("[data-chip-drop]"), { y: -60, opacity: 0 });
      gsap.set(q("[data-bar]"), { scaleY: 0 });
      typed.textContent = "";

      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: { trigger: el, start: "top top", end: "+=3200", pin: q("[data-pin]")[0], scrub: 0.6, anticipatePin: 1 },
      });

      // 01 quick add: type, then the understood parts pop out as chips
      tl.to(state, {
        chars: SENTENCE.length,
        duration: 1,
        ease: "none",
        onUpdate: () => {
          const n = Math.round(state.chars);
          typed.replaceChildren();
          const tmp = document.createElement("span");
          // Built from known text only, never from strings parsed as HTML.
          let at = 0;
          for (const [s, e, cls] of MARKS) {
            if (n <= at) break;
            if (s > at) tmp.append(SENTENCE.slice(at, Math.min(s, n)));
            if (n > s) {
              const m = document.createElement("mark");
              m.className = cn("rounded-sm text-ink", n >= e ? cls : "bg-transparent");
              m.textContent = SENTENCE.slice(s, Math.min(e, n));
              tmp.append(m);
            }
            at = e;
          }
          if (n > at) tmp.append(SENTENCE.slice(at, n));
          typed.append(...tmp.childNodes);
        },
      }).to(q("[data-chip]"), { opacity: 1, scale: 1, y: 0, stagger: 0.08, duration: 0.4, ease: "back.out(2)" }, ">-0.1");

      // Fly to each next scene: the current one rushes past and fades, the next comes forward.
      const fly = (i: number) => {
        tl.to(scenes[i - 1], { z: 500, opacity: 0, duration: 0.8, ease: "power2.in" }, "+=0.4")
          .to(scenes[i], { z: 0, opacity: 1, duration: 0.8, ease: "power2.out" }, "<0.15")
          .to(steps[i - 1], { scaleY: 0, transformOrigin: "bottom", duration: 0.4 }, "<")
          .to(steps[i], { scaleY: 1, transformOrigin: "top", duration: 0.4 }, "<");
      };
      fly(1);
      tl.to(q("[data-notice]"), { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.6)" });
      fly(2);
      tl.to(q("[data-chip-drop]"), { y: 0, opacity: 1, duration: 0.5, ease: "bounce.out" });
      fly(3);
      tl.to(q("[data-bar]"), { scaleY: 1, stagger: 0.05, duration: 0.5 });
      tl.to({}, { duration: 0.4 }); // hold the last frame

      return () => {
        typed.textContent = SENTENCE;
      };
    });
    return mm;
  }

  return (
    <section ref={root} id="features" aria-labelledby="story-h" className="border-t border-line">
      <div data-pin className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-8 lg:h-dvh lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-0">
        <div>
          <h2 id="story-h" className="font-mono text-2xs tracking-wider text-ink-3 uppercase">
            How it works
          </h2>
          <ol className="mt-6 flex flex-col gap-8">
            {STEPS.map((s) => (
              <li key={s.n} className="relative grid grid-cols-[2.5rem_1fr] gap-x-2">
                {/* Marks the step in view while pinned; text keeps full contrast throughout. */}
                <span data-step aria-hidden className="absolute top-1 bottom-1 -left-4 hidden w-0.5 origin-top rounded-full bg-accent lg:block" style={{ transform: "scaleY(0)" }} />
                <span className="pt-1.5 font-mono text-xs text-accent">{s.n}</span>
                <div>
                  <h3 className="font-display text-2xl text-ink">{s.title}</h3>
                  <p className="mt-1.5 max-w-[42ch] text-base text-ink-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div aria-hidden className="relative lg:h-[480px]" style={{ perspective: 1100 }}>
          <div className="flex flex-col items-center gap-10 lg:block lg:size-full" style={{ transformStyle: "preserve-3d" }}>
            {SCENES.map((Scene, i) => (
              <div key={i} data-scene className="flex w-full items-center justify-center">
                <Scene />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

