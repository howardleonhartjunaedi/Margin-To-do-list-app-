import { Plus } from "lucide-react";
import { Icon } from "@/components/ui/icon";

const QUESTIONS: [string, React.ReactNode][] = [
  ["Is it free?", "Yes. Every feature on this page is in the free account, and there’s no trial clock running."],
  [
    "What can I type into quick add?",
    <>
      Dates (“fri”, “next tuesday”, “in 3 days”), times (“3pm”, “at 14:30”), repeats (“every weekday”), priority (<code className="font-mono text-sm">p1</code>–
      <code className="font-mono text-sm">p4</code>), projects (<code className="font-mono text-sm">#home</code>), labels (
      <code className="font-mono text-sm">@errands</code>) and estimates (<code className="font-mono text-sm">~30m</code>). What it understands is highlighted as you
      type, so you can see what it will do before you press Enter.
    </>,
  ],
  ["How do reminders reach me?", "Inside Margin, as a notification on each browser you’ve allowed, and by email if you turn it on. Quiet hours hold them until the morning."],
  ["Can I share a list?", "Share any project by link or email, as an editor, commenter or viewer. Changes appear for everyone right away."],
  ["Does it work with my calendar?", "Subscribe to your tasks as a calendar feed from Settings → Integrations; dated tasks show up in Google Calendar, Apple Calendar or Outlook."],
  ["Can I bring my tasks in, or take them out?", "Import from CSV, JSON or plain text, one task per line. Export everything as JSON or CSV whenever you like."],
  ["Is there an API?", "Yes — a REST API with personal tokens, plus webhooks for when tasks change. The developer guide covers both."],
];

export function Faq() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
      <h2 id="faq-h" className="font-display text-3xl text-ink sm:text-4xl">
        Questions
      </h2>
      <div className="border-t border-line">
        {QUESTIONS.map(([q, a]) => (
          <details key={q} className="group border-b border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg text-ink [&::-webkit-details-marker]:hidden">
              {q}
              <Icon icon={Plus} className="shrink-0 text-ink-3 transition-transform duration-(--dur-base) ease-(--ease-move) group-open:rotate-45" />
            </summary>
            <div className="max-w-[60ch] pb-6 text-base text-ink-2">{a}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
