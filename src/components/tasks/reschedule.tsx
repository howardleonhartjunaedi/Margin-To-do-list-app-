"use client";

import { Calendar, CalendarDays, CalendarX2, Sofa, Sun, Sunrise } from "lucide-react";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, formatDue, fromISODate, weekdayShort } from "@/lib/dates";
import { cn } from "@/lib/cn";

export interface DateChoice {
  date: string | null;
  label: string;
}

/** The fixed, fast choices. One click each; the date picker is the slow path. */
export function quickDates(today: string): (DateChoice & { icon: typeof Sun; hint: string })[] {
  const dow = fromISODate(today).getDay(); // 0 Sun … 6 Sat
  const saturday = dow === 6 || dow === 0 ? today : addDays(today, 6 - dow); // already the weekend → today
  const monday = addDays(today, ((8 - dow) % 7) || 7);
  return [
    { date: today, label: "Today", icon: Sun, hint: weekdayShort(today) },
    { date: addDays(today, 1), label: "Tomorrow", icon: Sunrise, hint: weekdayShort(addDays(today, 1)) },
    { date: saturday, label: "This weekend", icon: Sofa, hint: weekdayShort(saturday) },
    { date: monday, label: "Next week", icon: CalendarDays, hint: `Mon ${fromISODate(monday).getDate()}` },
    { date: null, label: "No date", icon: CalendarX2, hint: "" },
  ];
}

export function DateMenu({
  today,
  value,
  onPick,
}: {
  today: string;
  value: string | null;
  onPick: (c: DateChoice) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col">
        {quickDates(today).map((o) => (
          <button
            key={o.label}
            onClick={() => onPick({ date: o.date, label: o.label.toLowerCase() })}
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-sm px-2 text-sm text-ink outline-none hover:bg-sunken focus-visible:bg-sunken",
              o.date === value && "font-medium",
            )}
          >
            <Icon icon={o.icon} className="text-ink-3" />
            <span className="flex-1 text-left">{o.label}</span>
            <span className="font-mono text-2xs text-ink-3">{o.hint}</span>
          </button>
        ))}
      </div>
      <label className="mt-1 flex items-center gap-2 border-t border-line px-2 pt-2 text-xs text-ink-2">
        <Icon icon={Calendar} className="text-ink-3" />
        Pick a date
        <input
          type="date"
          data-cursor="native"
          defaultValue={value ?? ""}
          onChange={(e) => e.target.value && onPick({ date: e.target.value, label: formatDue(e.target.value, today) })}
          className="ml-auto rounded-sm bg-raised px-1.5 py-1 font-mono text-2xs text-ink ring-1 ring-control ring-inset"
        />
      </label>
    </div>
  );
}

export function ReschedulePopover({
  today,
  value,
  onPick,
  open,
  onOpenChange,
  children,
}: {
  today: string;
  value: string | null;
  onPick: (c: DateChoice) => void;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  children: React.ReactElement;
}) {
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const setOpen = onOpenChange ?? setInner;
  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DateMenu
          today={today}
          value={value}
          onPick={(c) => {
            setOpen(false);
            onPick(c);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
