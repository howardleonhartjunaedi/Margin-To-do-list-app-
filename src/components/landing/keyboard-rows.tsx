import { cn } from "@/lib/cn";

/** The demo panel at rest: what shows before the animated loop loads, and with reduced motion. */
export function KeyboardStill({ today, rows }: { today: string; rows: string[] }) {
  return (
    <div aria-hidden className="relative rounded-md bg-raised p-5 shadow-2 ring-1 ring-line">
      <div className="mb-3 flex h-7 items-center">
        <span className="font-display text-xl text-ink">{today}</span>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r} className="relative flex items-center gap-3 border-b border-line px-2 py-3 text-sm">
            <span className={cn("grid size-4 place-items-center rounded-full ring-[1.5px] ring-control ring-inset")} />
            <span className="flex-1 text-ink">{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
