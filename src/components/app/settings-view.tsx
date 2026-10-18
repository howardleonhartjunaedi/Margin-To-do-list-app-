"use client";

import { BellRing, Languages, ListTree, Mail, Moon, Newspaper, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { ViewHeader } from "@/components/tasks/view-header";
import { useT } from "@/i18n/client";
import { rememberLocale } from "@/i18n/cookie";
import { isLocale, LOCALE_NAMES, LOCALES } from "@/i18n/locales";
import { IntegrationsSettings } from "./integrations-settings";
import { api } from "@/lib/api";
import { useSettings, useSettingsActions } from "@/lib/data";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";
import { describeOffset } from "@/lib/time/reminders";
import { useSession } from "@/lib/auth-client";

const timeInput =
  "h-8 rounded-md bg-raised px-2 font-mono text-xs text-ink ring-1 ring-control ring-inset disabled:opacity-45";
const select = "h-8 max-w-full rounded-md bg-raised px-2 text-sm text-ink ring-1 ring-control ring-inset";

export function SettingsView() {
  const q = useSettings();
  const save = useSettingsActions();
  const session = useSession();
  const router = useRouter();
  const t = useT().settings;
  const deviceTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [deviceTz];
    }
  }, [deviceTz]);

  if (q.isPending)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const s = q.data;

  return (
    <>
      <ViewHeader title={t.title} sub={t.sub} />

      <Section title={t.language} lede={t.languageLede}>
        <Row icon={Languages} title={t.language}>
          <select
            aria-label={t.language}
            value={s.locale ?? ""}
            onChange={async (e) => {
              const locale = isLocale(e.target.value) ? e.target.value : null;
              rememberLocale(locale);
              await save({ locale });
              router.refresh(); // the layout re-renders in the new language
            }}
            className={select}
          >
            <option value="">{t.matchBrowser}</option>
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title={t.reachTitle} lede={t.reachLede}>
        <PushRow devices={s.pushDevices} />
        <Row icon={Mail} title={t.email} hint={session.data?.user.email ? t.emailTo(session.data.user.email) : undefined}>
          <Switch checked={s.emailEnabled} onCheckedChange={(v) => void save({ emailEnabled: v })} aria-label={t.emailReminders} />
        </Row>
        <Row icon={BellRing} title={t.defaultReminder} hint={t.defaultReminderHint}>
          <select
            aria-label={t.defaultReminder}
            value={s.defaultReminderMinutes ?? ""}
            onChange={(e) => void save({ defaultReminderMinutes: e.target.value === "" ? null : Number(e.target.value) })}
            className="h-8 rounded-md bg-raised px-2 text-sm text-ink ring-1 ring-control ring-inset"
          >
            <option value="">{t.none}</option>
            {[0, 10, 30, 60, 1440].map((m) => (
              <option key={m} value={m}>
                {describeOffset(m)}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title={t.quietTitle} lede={t.quietLede}>
        <Row icon={Moon} title={t.holdOvernight}>
          <Switch checked={s.quietEnabled} onCheckedChange={(v) => void save({ quietEnabled: v })} aria-label={t.quietHours} />
        </Row>
        <div className="flex flex-wrap items-center gap-3 py-3 pl-8 text-sm text-ink-2">
          {t.from}
          <input
            type="time"
            aria-label={t.quietStart}
            data-cursor="native"
            disabled={!s.quietEnabled}
            defaultValue={s.quietStart}
            onBlur={(e) => e.target.value && e.target.value !== s.quietStart && void save({ quietStart: e.target.value })}
            className={timeInput}
          />
          {t.until}
          <input
            type="time"
            aria-label={t.quietEnd}
            data-cursor="native"
            disabled={!s.quietEnabled}
            defaultValue={s.quietEnd}
            onBlur={(e) => e.target.value && e.target.value !== s.quietEnd && void save({ quietEnd: e.target.value })}
            className={timeInput}
          />
        </div>
      </Section>

      <Section title={t.digestTitle} lede={t.digestLede}>
        <Row icon={Newspaper} title={t.sendDigest} hint={s.emailEnabled ? t.digestHintEmail : t.digestHintNoEmail}>
          <Switch checked={s.digestEnabled} onCheckedChange={(v) => void save({ digestEnabled: v })} aria-label={t.dailyDigest} />
        </Row>
        <div className="flex items-center gap-3 py-3 pl-8 text-sm text-ink-2">
          {t.at}
          <input
            type="time"
            aria-label={t.digestTime}
            data-cursor="native"
            disabled={!s.digestEnabled}
            defaultValue={s.digestTime}
            onBlur={(e) => e.target.value && e.target.value !== s.digestTime && void save({ digestTime: e.target.value })}
            className={timeInput}
          />
        </div>
      </Section>

      <Section title={t.timeTitle} lede={t.timeLede}>
        <div className="flex flex-col gap-3 py-3">
          <label className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink">
            {t.timeZone}
            <select value={s.timeZone} onChange={(e) => void save({ timeZone: e.target.value })} className={select}>
              {(zones.includes(s.timeZone) ? zones : [s.timeZone, ...zones]).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          {deviceTz !== s.timeZone && (
            <div className="flex flex-wrap items-center gap-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">
              {t.deviceZone(deviceTz.replace(/_/g, " "))}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void save({ timeZone: deviceTz })}>
                {t.useZone(deviceTz.split("/").pop()?.replace(/_/g, " ") ?? deviceTz)}
              </Button>
            </div>
          )}
          <label className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink">
            <span>
              {t.dayTime}
              <span className="block text-xs text-ink-3">{t.dayTimeHint}</span>
            </span>
            <input
              type="time"
              data-cursor="native"
              defaultValue={s.dayTime}
              onBlur={(e) => e.target.value && e.target.value !== s.dayTime && void save({ dayTime: e.target.value })}
              className={timeInput}
            />
          </label>
        </div>
      </Section>

      <Section title={t.aiTitle} lede={t.aiLede}>
        <Row icon={ListTree} title={t.aiRow} hint={s.aiAvailable ? t.aiHint : t.aiUnavailable}>
          <Switch
            checked={s.aiEnabled && s.aiAvailable}
            disabled={!s.aiAvailable}
            onCheckedChange={(v) => void save({ aiEnabled: v })}
            aria-label={t.aiLabel}
          />
        </Row>
      </Section>
      <IntegrationsSettings />
    </>
  );
}

function Section({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 border-t border-line pt-5">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <p className="mt-1 mb-3 max-w-[56ch] text-sm text-ink-2">{lede}</p>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function Row({ icon, title, hint, children }: { icon: typeof Mail; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon icon={icon} className="text-ink-3" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{title}</p>
        {hint && <p className="text-xs text-ink-3">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function PushRow({ devices }: { devices: number }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useT().settings;
  useEffect(() => void pushState().then(setState), []);

  const hint = state === "unsupported" ? t.pushUnsupported : state === "denied" ? t.pushDenied : t.pushDevices(devices);

  return (
    <Row icon={Smartphone} title={t.pushRow} hint={hint}>
      <div className="flex items-center gap-2">
        {state === "on" && (
          <>
            <Badge tone="success">{t.on}</Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await api.testPush().then(() => toast(t.testSent), (e) => toast(e.message));
              }}
            >
              {t.sendTest}
            </Button>
          </>
        )}
        {(state === "off" || state === "on") && (
          <Button
            size="sm"
            variant={state === "on" ? "ghost" : "secondary"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setState(state === "on" ? await disablePush() : await enablePush());
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {state === "on" ? t.turnOff : t.turnOn}
          </Button>
        )}
      </div>
    </Row>
  );
}
