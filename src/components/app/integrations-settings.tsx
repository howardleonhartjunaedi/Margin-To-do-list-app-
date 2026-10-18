"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarSync, Check, Copy, Download, KeyRound, RefreshCw, Send, Trash2, Upload, Webhook } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { ErrorState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { api, ApiError, type ImportSummary } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/dates";
import { useT } from "@/i18n/client";
import { m } from "@/i18n/catalogs";

const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : m().integrations.tryAgain);

function Section({ title, lede, children }: { title: string; lede: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-10 border-t border-line pt-5">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <p className="mt-1 mb-4 max-w-[60ch] text-sm text-ink-2">{lede}</p>
      {children}
    </section>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const t = useT().integrations;
  return (
    <div className="flex items-center gap-2">
      <code aria-label={label} className="min-w-0 flex-1 truncate rounded-sm bg-sunken px-2 py-2 font-mono text-2xs text-ink">
        {value}
      </code>
      <Button
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(value).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        <Icon icon={copied ? Check : Copy} size="xs" /> {copied ? t.copied : t.copy}
      </Button>
    </div>
  );
}

export function IntegrationsSettings() {
  return (
    <>
      <CalendarFeed />
      <ImportExport />
      <ApiTokens />
      <Webhooks />
    </>
  );
}

/* ------------------------------ Calendar ------------------------------ */

function CalendarFeed() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ical"], queryFn: api.feed });
  const set = (p: Promise<{ enabled: boolean; url: string | null }>) => p.then((d) => qc.setQueryData(["ical"], d), fail);
  const t = useT().integrations;
  return (
    <Section title={t.calTitle} lede={t.calLede}>
      <div className="flex items-center gap-3 py-1">
        <Icon icon={CalendarSync} className="text-ink-3" />
        <span className="flex-1 text-sm text-ink">{t.privateFeed}</span>
        <Switch checked={!!q.data?.enabled} onCheckedChange={(on) => set(on ? api.rotateFeed() : api.disableFeed())} aria-label={t.calendarFeed} />
      </div>
      {q.data?.url && (
        <div className="mt-3 flex flex-col gap-2 pl-7">
          <CopyField value={q.data.url} label={t.feedUrl} />
          <p className="text-xs text-ink-3">{t.calHow}</p>
          <Button size="sm" variant="ghost" className="self-start" onClick={() => set(api.rotateFeed())}>
            <Icon icon={RefreshCw} size="xs" /> {t.newLink}
          </Button>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------ Import / export ------------------------------ */

type Format = "text" | "csv" | "json";

function ImportExport() {
  const qc = useQueryClient();
  const [format, setFormat] = useState<Format>("text");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT().integrations;

  const run = async (dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.importData({ format, content, dryRun });
      if (dryRun) setPreview(r);
      else {
        toast(t.imported(r.tasks + r.subtasks));
        setContent("");
        setPreview(null);
        qc.invalidateQueries();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.cantRead);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={t.ioTitle} lede={t.ioLede}>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href="/api/export?format=json" download>
            <Icon icon={Download} size="xs" /> {t.exportAll}
          </a>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <a href="/api/export?format=csv" download>
            <Icon icon={Download} size="xs" /> {t.exportCsv}
          </a>
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-ink">{t.import}</span>
          <Segmented<Format>
            label={t.importFormat}
            size="sm"
            value={format}
            onValueChange={(f) => (setFormat(f), setPreview(null))}
            options={[
              { value: "text", label: t.formats.text },
              { value: "csv", label: t.formats.csv },
              { value: "json", label: t.formats.json },
            ]}
          />
          <label className="ml-auto cursor-default text-xs text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
            <input
              type="file"
              accept=".txt,.md,.csv,.json,text/plain,text/csv,application/json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2_000_000) return setError(t.tooBig);
                const ext = file.name.split(".").pop()?.toLowerCase();
                setFormat(ext === "csv" ? "csv" : ext === "json" ? "json" : "text");
                setContent(await file.text());
                setPreview(null);
              }}
            />
            <Icon icon={Upload} size="xs" className="mr-1 inline" />
            {t.chooseFile}
          </label>
        </div>
        <Textarea
          value={content}
          onChange={(e) => (setContent(e.target.value), setPreview(null))}
          className="min-h-32 font-mono text-xs"
          aria-label={t.pasteLabel}
          placeholder={t.placeholders[format]}
        />
        {error && <ErrorState message={error} />}
        {preview && (
          <div className="rounded-md bg-sunken p-3 text-sm text-ink">
            <p>
              {t.previewTasks(preview.tasks)}
              {preview.subtasks > 0 && t.previewSubtasks(preview.subtasks)}
              {preview.completed > 0 && t.previewDone(preview.completed)}
              {preview.newProjects.length > 0 && t.previewProjects(preview.newProjects.join(", "))}
            </p>
            <p className="mt-1 truncate text-xs text-ink-2">{t.startsWith(preview.sample.join(" · "))}</p>
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" disabled={!content.trim() || busy} onClick={() => void run(true)}>
            {t.preview}
          </Button>
          <Button size="sm" variant="primary" disabled={!preview || busy} onClick={() => void run(false)}>
            {busy ? t.importing : preview ? t.importN(preview.tasks + preview.subtasks) : t.import}
          </Button>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------ API tokens ------------------------------ */

function ApiTokens() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["tokens"], queryFn: api.tokens });
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const tr = useT().integrations;
  return (
    <Section
      title={tr.apiTitle}
      lede={
        <>
          {tr.apiLede(
            <Link key="guide" href="/developers" className="text-accent underline decoration-1 underline-offset-4">
              {tr.apiGuide}
            </Link>,
          )}
        </>
      }
    >
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          try {
            const t = await api.createToken(name.trim());
            setFresh(t.token);
            setName("");
            qc.invalidateQueries({ queryKey: ["tokens"] });
          } catch (err) {
            fail(err);
          }
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr.tokenPlaceholder} aria-label={tr.tokenName} className="min-w-0 flex-1" />
        <Button type="submit" disabled={!name.trim()}>
          <Icon icon={KeyRound} /> {tr.createToken}
        </Button>
      </form>
      {fresh && (
        <div className="mt-4 flex flex-col gap-2 rounded-md bg-warning-soft p-3">
          <p className="text-sm text-ink">{tr.copyNow}</p>
          <CopyField value={fresh} label={tr.newToken} />
        </div>
      )}
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {(q.data ?? []).map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-ink">{t.name}</p>
              <p className="font-mono text-2xs text-ink-3">
                {t.prefix}… · {t.lastUsedAt ? tr.used(timeAgo(t.lastUsedAt)) : tr.neverUsed}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={() =>
                void api.revokeToken(t.id).then(() => {
                  qc.invalidateQueries({ queryKey: ["tokens"] });
                  toast(tr.revoked(t.name));
                }, fail)
              }
            >
              {tr.revoke}
            </Button>
          </li>
        ))}
        {q.data?.length === 0 && <li className="py-3 text-sm text-ink-3">{tr.noTokens}</li>}
      </ul>
    </Section>
  );
}

/* ------------------------------ Webhooks ------------------------------ */

const EVENTS = ["task.created", "task.updated", "task.completed", "task.deleted", "comment.created"] as const;

function Webhooks() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["webhooks"], queryFn: api.webhooks });
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["task.created", "task.completed"]);
  const [secret, setSecret] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["webhooks"] });
  const t = useT().integrations;

  return (
    <Section title={t.hooksTitle} lede={t.hooksLede}>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const w = await api.createWebhook({ url: url.trim(), events });
            setSecret(w.secret);
            setUrl("");
            refresh();
          } catch (err) {
            fail(err);
          }
        }}
      >
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/margin-hook" aria-label={t.hookUrl} inputMode="url" />
        <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
          <legend className="sr-only">{t.eventsLegend}</legend>
          {EVENTS.map((id) => (
            <label key={id} className="flex items-center gap-2 text-sm text-ink">
              <Checkbox checked={events.includes(id)} onCheckedChange={(v) => setEvents((es) => (v ? [...es, id] : es.filter((x) => x !== id)))} />
              {t.events[id]}
            </label>
          ))}
        </fieldset>
        <Button type="submit" className="self-start" disabled={!url.trim() || !events.length}>
          <Icon icon={Webhook} /> {t.addHook}
        </Button>
      </form>
      {secret && (
        <div className="mt-4 flex flex-col gap-2 rounded-md bg-warning-soft p-3">
          <p className="text-sm text-ink">{t.secretNote}</p>
          <CopyField value={secret} label={t.secretLabel} />
        </div>
      )}
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {(q.data ?? []).map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs text-ink">{w.url}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <Badge tone={w.active ? (w.failureCount ? "warning" : "success") : "danger"}>
                  {w.active ? (w.failureCount ? t.failures(w.failureCount) : t.active) : t.switchedOff}
                </Badge>
                {w.events.join(", ")}
                {w.lastDeliveryAt && <span>{t.last(String(w.lastStatus ?? t.error), timeAgo(w.lastDeliveryAt))}</span>}
              </p>
            </div>
            <Switch
              checked={w.active}
              aria-label={w.active ? t.switchOff : t.switchOn}
              onCheckedChange={(active) => void api.updateWebhook(w.id, { active }).then(refresh, fail)}
            />
            <Button size="sm" variant="ghost" onClick={() => void api.testWebhook(w.id).then(() => toast(t.pingQueued), fail)}>
              <Icon icon={Send} size="xs" /> {t.test}
            </Button>
            <Deliveries id={w.id} />
            <Button size="icon-sm" variant="ghost" aria-label={t.deleteHook} onClick={() => void api.deleteWebhook(w.id).then(refresh, fail)}>
              <Icon icon={Trash2} size="xs" />
            </Button>
          </li>
        ))}
        {q.data?.length === 0 && <li className="py-3 text-sm text-ink-3">{t.noHooks}</li>}
      </ul>
    </Section>
  );
}

function Deliveries({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["deliveries", id], queryFn: () => api.deliveries(id), enabled: open, refetchInterval: open ? 5000 : false });
  const t = useT().integrations;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost">
          {t.log}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <ul className="max-h-72 overflow-y-auto" data-lenis-prevent>
          {(q.data ?? []).map((d) => (
            <li key={d.id} className="flex items-center gap-2 border-b border-line px-1 py-1.5 text-xs last:border-0">
              <span className={cn("size-1.5 shrink-0 rounded-full", d.status === "sent" ? "bg-success" : d.status === "failed" ? "bg-danger" : "bg-warning")} />
              <span className="font-mono text-ink">{d.event}</span>
              <span className="text-ink-3">{d.status === "sent" ? d.responseStatus : d.error ?? d.status}</span>
              <span className="ml-auto font-mono text-2xs text-ink-3">{timeAgo(d.createdAt)}</span>
            </li>
          ))}
          {q.data?.length === 0 && <li className="p-2 text-xs text-ink-3">{t.nothingSent}</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
