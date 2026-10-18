"use client";

import { Kbd } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { quickAddSyntax, shortcutGroups } from "@/lib/shortcuts";
import { useT } from "@/i18n/client";
import { useAppUI } from "./app-ui";

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useAppUI();
  const t = useT().keys;
  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent title={t.title} description={t.description} className="max-w-2xl">
        <div className="grid max-h-[60vh] gap-x-10 gap-y-6 overflow-y-auto sm:grid-cols-2" data-lenis-prevent>
          {shortcutGroups().map((g) => (
            <section key={g.title}>
              <h3 className="mb-2 font-mono text-2xs tracking-wider text-ink-3 uppercase">{g.title}</h3>
              <dl className="flex flex-col gap-1.5">
                {g.items.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-4 text-sm">
                    <dt className="text-ink-2">{s.label}</dt>
                    <dd className="flex shrink-0 items-center gap-1">
                      {s.keys.map((k, i) => (
                        <span key={k + i} className="inline-flex items-center gap-1">
                          {i > 0 && s.sequence && <span className="text-2xs text-ink-3">{t.then}</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <section className="sm:col-span-2">
            <h3 className="mb-2 font-mono text-2xs tracking-wider text-ink-3 uppercase">{t.inQuickAdd}</h3>
            <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {quickAddSyntax().map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-3">
                  <dt className="w-28 shrink-0 font-mono text-xs text-ink">{k}</dt>
                  <dd className="text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
