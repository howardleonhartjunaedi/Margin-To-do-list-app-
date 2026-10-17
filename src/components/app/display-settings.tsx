"use client";

import { Monitor, Moon, SlidersHorizontal, Sun } from "lucide-react";
import { usePreferences, type ThemePref } from "@/components/providers/preferences";
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
  const { prefs, set, osReducedMotion } = usePreferences();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className={cn(compact && "size-8 px-0", className)} aria-label="Display">
          <Icon icon={SlidersHorizontal} />
          {!compact && " Display"}
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-80 p-4">
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
