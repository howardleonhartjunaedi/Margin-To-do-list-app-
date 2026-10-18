"use client";

import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";
import { Bell, CalendarDays, Flag, Hash } from "lucide-react";
import { useEffect, useRef } from "react";
import { usePreferences } from "@/components/providers/preferences";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { Messages } from "@/i18n/catalogs";

/*
 * The feature story. On wide screens with Full motion the section pins, and scrolling
 * moves a camera through four scenes laid out in depth (CSS 3D, transform + opacity only),
 * while the matching step of the text comes forward. Everywhere else the same four scenes
 * simply stack — same content, no choreography.
 */

type T = Messages["landing"];

const MARK_STYLE = { date: "bg-accent-soft", priority: "bg-warning-soft", project: "bg-sunken ring-1 ring-line-strong ring-inset" } as const;

/** Character ranges of the highlighted parts, found in the sentence itself (so any language works). */
function marksFor(t: T): [number, number, string][] {
  return t.sentenceMarks
    .map(([part, kind]) => {
      const s = t.sentence.indexOf(part);
      return [s, s + part.length, MARK_STYLE[kind]] as [number, number, string];
    })
    .filter(([s]) => s >= 0)
    .sort((a, b) => a[0] - b[0]);
}

function SceneQuickAdd({ t }: { t: T }) {
  return (
    <div className="w-full max-w-md rounded-md bg-raised p-5 shadow-2 ring-1 ring-line">
      <p className="font-mono text-2xs tracking-wider text-ink-3 uppercase">{t.quickAdd}</p>
      <p className="mt-3 min-h-8 text-lg text-ink" data-typed>
        <span data-typed-text>{t.sentence}</span>
        <span className="ml-0.5 inline-block h-5 w-px translate-y-1 bg-ink" data-caret />
      </p>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {[CalendarDays, Bell, Flag, Hash].map((I, i) => (
          <li key={i} data-chip className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-sunken px-2 text-xs text-ink">
            <Icon icon={I} size="xs" className="text-ink-3" />
            {t.chips[i]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SceneReminder({ t }: { t: T }) {
  return (
    <div className="w-full max-w-sm">
      <p className="mb-3 text-center font-mono text-3xl text-ink-3" data-clock>
        13:45
      </p>
      <div data-notice className="rounded-md bg-ink p-4 text-bg shadow-3">
        <div className="flex items-center gap-2 text-xs text-bg/70">
          <Icon icon={Bell} size="xs" /> Margin · {t.now}
        </div>
        <p className="mt-2 text-base font-medium">{t.reminderTitle}</p>
        <p className="text-sm text-bg/75">{t.reminderDue}</p>
        <div className="mt-3 flex gap-4 text-sm">
          <span className="font-medium underline decoration-bg/40 underline-offset-4">{t.done}</span>
          <span className="text-bg/75">{t.snooze}</span>
        </div>
      </div>
    </div>
  );
}

function SceneCalendar({ t }: { t: T }) {
  const days = Array.from({ length: 21 }, (_, i) => i + 12);
  return (
    <div className="w-full max-w-md rounded-md bg-raised p-4 shadow-2 ring-1 ring-line">
      <p className="mb-3 font-display text-lg text-ink">{t.month}</p>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-sm bg-line">
        {days.map((d) => (
          <div key={d} className="relative h-12 bg-bg p-1 font-mono text-2xs text-ink-3">
            {d}
            {d === 21 && (
              <span data-chip-drop className="absolute inset-x-1 bottom-1 truncate rounded-sm bg-accent-soft px-1 text-2xs text-ink">
                {t.calendarChips.plumber}
              </span>
            )}
            {d === 15 && <span className="absolute inset-x-1 bottom-1 truncate rounded-sm bg-sunken px-1 text-2xs text-ink-2">{t.calendarChips.budget}</span>}
            {d === 24 && <span className="absolute inset-x-1 bottom-1 truncate rounded-sm bg-sunken px-1 text-2xs text-ink-2">{t.calendarChips.flights}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneStats({ t, weekdays }: { t: T; weekdays: string[] }) {
  const bars = [3, 5, 2, 6, 4, 7, 5];
  return (
    <div className="w-full max-w-md rounded-md bg-raised p-5 shadow-2 ring-1 ring-line">
      <p className="text-xs text-ink-2">{t.doneThisWeek}</p>
      <p className="font-sans text-5xl font-semibold tracking-tight text-ink" data-count>
        32
      </p>
      <div className="mt-4 flex h-28 items-end gap-2" role="img" aria-label={t.barsLabel}>
        {bars.map((b, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div data-bar className={cn("w-full max-w-6 origin-bottom rounded-t-sm", i === 5 ? "bg-accent" : "bg-ink-3")} style={{ height: `${(b / 7) * 85}%` }} />
            <span className="font-mono text-2xs text-ink-3">{weekdays[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SCENES: React.ComponentType<{ t: T; weekdays: string[] }>[] = [SceneQuickAdd, SceneReminder, SceneCalendar, SceneStats];

/** weekdays: Monday-first narrow names in the page's language. */
export function Story({ t, weekdays }: { t: T; weekdays: string[] }) {
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
  }, [level, t]);

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
      const SENTENCE = t.sentence;
      const MARKS = marksFor(t);

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
            {t.howItWorks}
          </h2>
          <ol className="mt-6 flex flex-col gap-8">
            {t.steps.map((s, i) => (
              <li key={i} className="relative grid grid-cols-[2.5rem_1fr] gap-x-2">
                {/* Marks the step in view while pinned; text keeps full contrast throughout. */}
                <span data-step aria-hidden className="absolute top-1 bottom-1 -left-4 hidden w-0.5 origin-top rounded-full bg-accent lg:block" style={{ transform: "scaleY(0)" }} />
                <span className="pt-1.5 font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
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
                <Scene t={t} weekdays={weekdays} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

