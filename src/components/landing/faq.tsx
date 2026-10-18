import { Plus } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import type { Messages } from "@/i18n/catalogs";

export function Faq({ t }: { t: Messages["landing"] }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
      <h2 id="faq-h" className="font-display text-3xl text-ink sm:text-4xl">
        {t.questions}
      </h2>
      <div className="border-t border-line">
        {t.faqs.map(([q, a]) => (
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
