import { Kbd } from "@/components/ui/badge";
import type { Messages } from "@/i18n/catalogs";
import { KeyboardLoop } from "./lazy-sections";

const KEYS: string[][] = [["Q"], ["J", "K"], ["X"], ["T"], ["1", "4"], ["Ctrl", "K"]];

/** Server-rendered copy and shortcut list; only the animated panel is client code, fetched near the viewport. */
export function Keyboard({ t }: { t: Messages["landing"] }) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <h2 id="keys-h" className="font-display text-3xl text-ink sm:text-4xl">
          {t.keysTitle}
        </h2>
        <p className="mt-4 max-w-[44ch] text-base text-ink-2">{t.keysBody}</p>
        <dl className="mt-8 grid max-w-sm gap-y-3">
          {KEYS.map((keys, i) => (
            <div key={keys.join()} className="flex items-center justify-between gap-4 border-b border-line pb-2 text-sm">
              <dt className="text-ink-2">{t.shortcuts[i]}</dt>
              <dd className="flex gap-1">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <KeyboardLoop today={t.loopToday} rows={t.loopRows} />
    </div>
  );
}
