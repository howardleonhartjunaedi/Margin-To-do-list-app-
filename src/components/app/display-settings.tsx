"use client";

import { Monitor, Moon, SlidersHorizontal, Sun } from "lucide-react";
import { ACCENTS, usePreferences, type ContrastPref, type ThemePref } from "@/components/providers/preferences";
import { useT } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import type { MotionLevel } from "@/design/motion";
import { cn } from "@/lib/cn";

export function DisplaySettings({
  side = "bottom",
  align = "end",
  compact = false,
  className,
}: {
  side?: "top" | "bottom";
  align?: "start" | "end";
  compact?: boolean;
  className?: string;
}) {
  const { prefs, set, osReducedMotion, resolvedTheme } = usePreferences();
  const t = useT().display;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className={cn(compact && "size-8 px-0", className)} aria-label={t.display}>
          <Icon icon={SlidersHorizontal} />
          {!compact && ` ${t.display}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-80 p-4">
        <div className="flex flex-col gap-5">
          <Row label={t.theme}>
            <Segmented<ThemePref>
              label={t.theme}
              size="sm"
              value={prefs.theme}
              onValueChange={(v) => set("theme", v)}
              options={[
                { value: "light", label: <Icon icon={Sun} size="xs" label={t.light} />, title: t.light },
                { value: "dark", label: <Icon icon={Moon} size="xs" label={t.dark} />, title: t.dark },
                { value: "system", label: <Icon icon={Monitor} size="xs" label={t.system} />, title: t.matchSystem },
              ]}
            />
          </Row>
          <Row label={t.contrast} hint={prefs.contrast === "system" ? t.contrastHint : undefined}>
            <Segmented<ContrastPref>
              label={t.contrast}
              size="sm"
              value={prefs.contrast}
              onValueChange={(v) => set("contrast", v)}
              options={[
                { value: "system", label: t.auto },
                { value: "standard", label: t.standard },
                { value: "high", label: t.high },
              ]}
            />
          </Row>
          <Row label={t.accent}>
            <div role="radiogroup" aria-label={t.accentColor} className="flex gap-1.5">
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={prefs.accent === a}
                  aria-label={t.accents[a]}
                  title={t.accents[a]}
                  onClick={() => set("accent", a)}
                  className="grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-raised transition-shadow duration-(--dur-fast) aria-checked:ring-2 aria-checked:ring-ink"
                >
                  {/* The swatch carries its own accent (and the current theme), so CSS gives the exact color in use. */}
                  <span data-accent={a} data-theme={resolvedTheme} className="size-5 rounded-full bg-accent" />
                </button>
              ))}
            </div>
          </Row>
          <Row
            label={t.motion}
            hint={osReducedMotion ? t.motionOsHint : undefined}
          >
            <Segmented<MotionLevel>
              label={t.motion}
              size="sm"
              value={prefs.motion}
              onValueChange={(v) => set("motion", v)}
              options={[
                { value: "full", label: t.full },
                { value: "reduced", label: t.reduced },
                { value: "off", label: t.off },
              ]}
            />
          </Row>
          <Row label={t.cursor} hint={t.cursorHint}>
            <Switch checked={prefs.cursor} onCheckedChange={(v) => set("cursor", v)} aria-label={t.cursor} />
          </Row>
          <Row label={t.celebrate}>
            <Switch checked={prefs.celebrate} onCheckedChange={(v) => set("celebrate", v)} aria-label={t.celebrate} />
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
