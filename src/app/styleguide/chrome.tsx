"use client";

import { useEffect, useState } from "react";
import { DisplaySettings } from "@/components/app/display-settings";
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
