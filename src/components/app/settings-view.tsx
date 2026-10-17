"use client";

import { BellRing, Mail, Moon, Newspaper, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { ViewHeader } from "@/components/tasks/view-header";
import { IntegrationsSettings } from "./integrations-settings";
import { api } from "@/lib/api";
import { useSettings, useSettingsActions } from "@/lib/data";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";
import { describeOffset } from "@/lib/time/reminders";
import { useSession } from "@/lib/auth-client";

const timeInput =
  "h-8 rounded-md bg-raised px-2 font-mono text-xs text-ink ring-1 ring-control ring-inset disabled:opacity-45";

export function SettingsView() {
  const q = useSettings();
  const save = useSettingsActions();
  const session = useSession();
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
      <ViewHeader title="Settings" sub="Saved as you change them" />

      <Section title="Where reminders reach you" lede="You always see reminders here in Margin. Add your devices and inbox if you like.">
        <PushRow devices={s.pushDevices} />
        <Row icon={Mail} title="Email" hint={session.data?.user.email ? `To ${session.data.user.email}` : undefined}>
          <Switch checked={s.emailEnabled} onCheckedChange={(v) => void save({ emailEnabled: v })} aria-label="Email reminders" />
        </Row>
        <Row icon={BellRing} title="Default reminder" hint="Added when a task gets a time.">
          <select
            aria-label="Default reminder"
            value={s.defaultReminderMinutes ?? ""}
            onChange={(e) => void save({ defaultReminderMinutes: e.target.value === "" ? null : Number(e.target.value) })}
            className="h-8 rounded-md bg-raised px-2 text-sm text-ink ring-1 ring-control ring-inset"
          >
            <option value="">None</option>
            {[0, 10, 30, 60, 1440].map((m) => (
              <option key={m} value={m}>
                {describeOffset(m)}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Quiet hours" lede="Reminders that fall in this window wait until it ends. Nothing is lost.">
        <Row icon={Moon} title="Hold reminders overnight">
          <Switch checked={s.quietEnabled} onCheckedChange={(v) => void save({ quietEnabled: v })} aria-label="Quiet hours" />
        </Row>
        <div className="flex flex-wrap items-center gap-3 py-3 pl-8 text-sm text-ink-2">
          From
          <input
            type="time"
            aria-label="Quiet hours start"
            data-cursor="native"
            disabled={!s.quietEnabled}
            defaultValue={s.quietStart}
            onBlur={(e) => e.target.value && e.target.value !== s.quietStart && void save({ quietStart: e.target.value })}
            className={timeInput}
          />
          until
          <input
            type="time"
            aria-label="Quiet hours end"
            data-cursor="native"
            disabled={!s.quietEnabled}
            defaultValue={s.quietEnd}
            onBlur={(e) => e.target.value && e.target.value !== s.quietEnd && void save({ quietEnd: e.target.value })}
            className={timeInput}
          />
        </div>
      </Section>

      <Section title="Daily digest" lede="One short summary of what’s due today and what’s overdue. Skipped on days with nothing due.">
        <Row icon={Newspaper} title="Send a morning digest" hint={s.emailEnabled ? "In Margin and by email." : "In Margin. Turn on email above to get it in your inbox too."}>
          <Switch checked={s.digestEnabled} onCheckedChange={(v) => void save({ digestEnabled: v })} aria-label="Daily digest" />
        </Row>
        <div className="flex items-center gap-3 py-3 pl-8 text-sm text-ink-2">
          At
          <input
            type="time"
            aria-label="Digest time"
            data-cursor="native"
            disabled={!s.digestEnabled}
            defaultValue={s.digestTime}
            onBlur={(e) => e.target.value && e.target.value !== s.digestTime && void save({ digestTime: e.target.value })}
            className={timeInput}
          />
        </div>
      </Section>

      <Section title="Time" lede="Due times, quiet hours and the digest all follow this time zone.">
        <div className="flex flex-col gap-3 py-3">
          <label className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink">
            Time zone
            <select
              value={s.timeZone}
              onChange={(e) => void save({ timeZone: e.target.value })}
              className="h-8 max-w-full rounded-md bg-raised px-2 text-sm text-ink ring-1 ring-control ring-inset"
            >
              {(zones.includes(s.timeZone) ? zones : [s.timeZone, ...zones]).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          {deviceTz !== s.timeZone && (
            <div className="flex flex-wrap items-center gap-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">
              This device is set to {deviceTz.replace(/_/g, " ")}.
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void save({ timeZone: deviceTz })}>
                Use {deviceTz.split("/").pop()?.replace(/_/g, " ")}
              </Button>
            </div>
          )}
          <label className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink">
            <span>
              Reminder time for tasks without a time
              <span className="block text-xs text-ink-3">“At time of task” on a date-only task fires then.</span>
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
  useEffect(() => void pushState().then(setState), []);

  const hint =
    state === "unsupported"
      ? "This browser can’t receive push notifications."
      : state === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser’s site settings."
        : `${devices} ${devices === 1 ? "device" : "devices"} subscribed.`;

  return (
    <Row icon={Smartphone} title="Push on this device" hint={hint}>
      <div className="flex items-center gap-2">
        {state === "on" && (
          <>
            <Badge tone="success">On</Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await api.testPush().then(() => toast("Test sent — it should appear in a moment."), (e) => toast(e.message));
              }}
            >
              Send a test
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
            {state === "on" ? "Turn off" : "Turn on"}
          </Button>
        )}
      </div>
    </Row>
  );
}
