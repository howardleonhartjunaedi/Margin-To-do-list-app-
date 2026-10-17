import Link from "next/link";
import { Button } from "@/components/ui/button";

// Interim front door. The full landing page (3D hero, scroll story, live demo) is Phase 6.
// Signed-in visitors never see this: proxy.ts sends them to /today.
export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-8">
      <header className="flex h-16 items-center gap-4">
        <span className="font-display text-xl font-medium tracking-tight text-ink">
          Margin<span className="text-accent">.</span>
        </span>
        <nav className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href="/sign-up">Create account</Link>
          </Button>
        </nav>
      </header>

      <main className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="max-w-[14ch] font-display text-4xl text-ink sm:text-5xl">
            Write it down. <em className="text-accent">Get on</em> with your day.
          </h1>
          <p className="mt-6 max-w-[46ch] text-base text-ink-2">
            Type a task the way you’d say it — “dentist friday 3pm” — and Margin files it under the right day. Everything
            else stays quiet until it matters.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="primary" size="lg" magnetic>
              <Link href="/sign-up">Start a list — it’s free</Link>
            </Button>
          </div>
        </div>

        <figure aria-label="Example: a Today list" className="rounded-md bg-raised p-6 shadow-2 ring-1 ring-line">
          <p className="font-display text-2xl text-ink">Today</p>
          <ul className="mt-4 divide-y divide-line text-sm">
            {[
              ["Renew passport before the Lisbon trip", "Overdue", "text-danger", "ring-p1"],
              ["Call the plumber about the upstairs leak", "14:00", "text-ink-2", "ring-p2"],
              ["Draft Q4 budget notes", "", "text-ink-2", "ring-p3"],
              ["Water the plants", "Every 3 days", "text-ink-2", "ring-control"],
            ].map(([title, meta, tone, ring]) => (
              <li key={title} className="flex items-start gap-3 py-3">
                <span className={`mt-0.5 size-5 shrink-0 rounded-full ring-[1.5px] ring-inset ${ring}`} />
                <span className="flex-1">
                  <span className="block text-ink">{title}</span>
                  {meta && <span className={`font-mono text-2xs ${tone}`}>{meta}</span>}
                </span>
              </li>
            ))}
          </ul>
        </figure>
      </main>

      <footer className="flex h-16 items-center border-t border-line text-xs text-ink-3">
        <span>Margin — a calm task manager.</span>
        <Link href="/styleguide" className="ml-auto hover:text-ink-2">
          Style guide
        </Link>
      </footer>
    </div>
  );
}
