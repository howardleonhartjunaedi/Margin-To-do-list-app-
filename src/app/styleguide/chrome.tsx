"use client";

import { Monitor, Moon, SlidersHorizontal, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { usePreferences, type ThemePref } from "@/components/providers/preferences";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import type { MotionLevel } from "@/design/motion";
import { cn } from "@/lib/cn";

export function StyleguideHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-[6px]">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-8">
        <a href="#main" className="sr-only focus:not-sr-only">
          Skip to content
        </a>
        <span className="font-display text-xl font-medium tracking-tight text-ink">
          Margin<span className="text-accent">.</span>
        </span>
        <span className="font-mono text-2xs text-ink-3 max-xs:hidden">/styleguide</span>
        <div className="ml-auto">
          <DisplaySettings />
        </div>
      </div>
    </header>
  );
}

export function DisplaySettings() {
  const { prefs, set, osReducedMotion } = usePreferences();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost">
          <Icon icon={SlidersHorizontal} /> Display
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="flex flex-col gap-5">
          <Row label="Theme">
            <Segmented<ThemePref>
              label="Theme"
              size="sm"
              value={prefs.theme}
              onValueChange={(v) => set("theme", v)}
              options={[
                { value: "light", label: <Icon icon={Sun} size="xs" label="Light" />, title: "Light" },
                { value: "dark", label: <Icon icon={Moon} size="xs" label="Dark" />, title: "Dark" },
                { value: "system", label: <Icon icon={Monitor} size="xs" label="System" />, title: "Match system" },
              ]}
            />
          </Row>
          <Row
            label="Motion"
            hint={osReducedMotion ? "Your system asks for reduced motion, so Full acts as Reduced." : undefined}
          >
            <Segmented<MotionLevel>
              label="Motion"
              size="sm"
              value={prefs.motion}
              onValueChange={(v) => set("motion", v)}
              options={[
                { value: "full", label: "Full" },
                { value: "reduced", label: "Reduced" },
                { value: "off", label: "Off" },
              ]}
            />
          </Row>
          <Row label="Custom cursor" hint="Mouse and trackpad only. Off when motion isn't Full.">
            <Switch checked={prefs.cursor} onCheckedChange={(v) => set("cursor", v)} aria-label="Custom cursor" />
          </Row>
          <Row label="Celebrate cleared lists">
            <Switch checked={prefs.celebrate} onCheckedChange={(v) => set("celebrate", v)} aria-label="Celebrate cleared lists" />
          </Row>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-ink">{label}</span>
        {children}
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function Toc({ sections }: { sections: readonly (readonly [string, string])[] }) {
  const [active, setActive] = useState<string>(sections[0][0]);

  useEffect(() => {
    // The current section is the last one whose top has passed 30% of the viewport.
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.3;
      let current = sections[0][0];
      for (const [id] of sections) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [sections]);

  return (
    <nav aria-label="Sections" className="max-lg:hidden">
      <ol className="sticky top-14 flex flex-col gap-0.5 pt-20">
        {sections.map(([id, label], i) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={active === id ? "location" : undefined}
              className={cn(
                "flex items-baseline gap-3 rounded-sm py-1 text-sm transition-colors duration-(--dur-fast)",
                active === id ? "text-ink" : "text-ink-3 hover:text-ink-2",
              )}
            >
              <span className="w-5 font-mono text-2xs">{String(i + 1).padStart(2, "0")}</span>
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
