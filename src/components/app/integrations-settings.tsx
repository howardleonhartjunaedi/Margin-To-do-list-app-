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

const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : "Something went wrong. Try again.");

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
        <Icon icon={copied ? Check : Copy} size="xs" /> {copied ? "Copied" : "Copy"}
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
  return (
    <Section
      title="Calendar feed"
      lede="See your dated tasks in Google Calendar, Apple Calendar or Outlook. It’s read-only and refreshes about hourly. Anyone with the link can read it, so keep it to yourself."
    >
      <div className="flex items-center gap-3 py-1">
        <Icon icon={CalendarSync} className="text-ink-3" />
        <span className="flex-1 text-sm text-ink">Private feed</span>
        <Switch checked={!!q.data?.enabled} onCheckedChange={(on) => set(on ? api.rotateFeed() : api.disableFeed())} aria-label="Calendar feed" />
      </div>
      {q.data?.url && (
        <div className="mt-3 flex flex-col gap-2 pl-7">
          <CopyField value={q.data.url} label="Calendar feed URL" />
          <p className="text-xs text-ink-3">
            Google: Other calendars → From URL. Apple: File → New Calendar Subscription. Outlook: Add calendar → Subscribe from web.
          </p>
          <Button size="sm" variant="ghost" className="self-start" onClick={() => set(api.rotateFeed())}>
            <Icon icon={RefreshCw} size="xs" /> Get a new link (the old one stops working)
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

  const run = async (dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.importData({ format, content, dryRun });
      if (dryRun) setPreview(r);
      else {
        toast(`Imported ${r.tasks + r.subtasks} ${r.tasks + r.subtasks === 1 ? "task" : "tasks"}.`);
        setContent("");
        setPreview(null);
        qc.invalidateQueries();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn’t read that. Check the format and try again.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Import and export" lede="Bring tasks in from a list, a spreadsheet or another Margin account. Take everything out whenever you like.">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href="/api/export?format=json" download>
            <Icon icon={Download} size="xs" /> Export everything (JSON)
          </a>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <a href="/api/export?format=csv" download>
            <Icon icon={Download} size="xs" /> Tasks as CSV
          </a>
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-ink">Import</span>
          <Segmented<Format>
            label="Import format"
            size="sm"
            value={format}
            onValueChange={(f) => (setFormat(f), setPreview(null))}
            options={[
              { value: "text", label: "Plain list" },
              { value: "csv", label: "CSV" },
              { value: "json", label: "Margin JSON" },
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
                if (file.size > 2_000_000) return setError("That file is over 2 MB. Split it into smaller files.");
                const ext = file.name.split(".").pop()?.toLowerCase();
                setFormat(ext === "csv" ? "csv" : ext === "json" ? "json" : "text");
                setContent(await file.text());
                setPreview(null);
              }}
            />
            <Icon icon={Upload} size="xs" className="mr-1 inline" />
            Choose a file
          </label>
        </div>
        <Textarea
          value={content}
          onChange={(e) => (setContent(e.target.value), setPreview(null))}
          className="min-h-32 font-mono text-xs"
          aria-label="Paste tasks to import"
          placeholder={
            format === "text"
              ? "One task per line, quick-add syntax works:\nPlan the trip #travel p2\n  Book flights tomorrow\n- [x] Renew passport"
              : format === "csv"
                ? "title,due_date,priority,project,labels\nPay rent,2026-11-01,p1,Home,bills"
                : "Paste a Margin JSON export"
          }
        />
        {error && <ErrorState message={error} />}
        {preview && (
          <div className="rounded-md bg-sunken p-3 text-sm text-ink">
            <p>
              {preview.tasks} {preview.tasks === 1 ? "task" : "tasks"}
              {preview.subtasks > 0 && `, ${preview.subtasks} subtasks`}
              {preview.completed > 0 && ` (${preview.completed} already done)`}
              {preview.newProjects.length > 0 && ` · new projects: ${preview.newProjects.join(", ")}`}
            </p>
            <p className="mt-1 truncate text-xs text-ink-2">Starts with: {preview.sample.join(" · ")}</p>
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" disabled={!content.trim() || busy} onClick={() => void run(true)}>
            Preview
          </Button>
          <Button size="sm" variant="primary" disabled={!preview || busy} onClick={() => void run(false)}>
            {busy ? "Importing…" : preview ? `Import ${preview.tasks + preview.subtasks} tasks` : "Import"}
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
  return (
    <Section
      title="API"
      lede={
        <>
          Personal tokens let scripts and other apps use your account through the REST API.{" "}
          <Link href="/developers" className="text-accent underline decoration-1 underline-offset-4">
            Read the API guide
          </Link>
          .
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
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="What it’s for — e.g. “Shortcuts”" aria-label="Token name" className="min-w-0 flex-1" />
        <Button type="submit" disabled={!name.trim()}>
          <Icon icon={KeyRound} /> Create token
        </Button>
      </form>
      {fresh && (
        <div className="mt-4 flex flex-col gap-2 rounded-md bg-warning-soft p-3">
          <p className="text-sm text-ink">Copy it now — you won’t see it again.</p>
          <CopyField value={fresh} label="New API token" />
        </div>
      )}
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {(q.data ?? []).map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-ink">{t.name}</p>
              <p className="font-mono text-2xs text-ink-3">
                {t.prefix}… · {t.lastUsedAt ? `used ${timeAgo(t.lastUsedAt)}` : "never used"}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={() =>
                void api.revokeToken(t.id).then(() => {
                  qc.invalidateQueries({ queryKey: ["tokens"] });
                  toast(`Revoked “${t.name}”. Anything using it stops working now.`);
                }, fail)
              }
            >
              Revoke
            </Button>
          </li>
        ))}
        {q.data?.length === 0 && <li className="py-3 text-sm text-ink-3">No tokens yet.</li>}
      </ul>
    </Section>
  );
}

/* ------------------------------ Webhooks ------------------------------ */

const EVENTS = [
  ["task.created", "Task added"],
  ["task.updated", "Task changed"],
  ["task.completed", "Task completed"],
  ["task.deleted", "Task deleted"],
  ["comment.created", "New comment"],
] as const;

function Webhooks() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["webhooks"], queryFn: api.webhooks });
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["task.created", "task.completed"]);
  const [secret, setSecret] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["webhooks"] });

  return (
    <Section
      title="Webhooks"
      lede="Margin POSTs a signed JSON payload to your URL when things change. Failed deliveries retry for about half an hour; an endpoint that keeps failing is switched off."
    >
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
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/margin-hook" aria-label="Webhook URL" inputMode="url" />
        <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
          <legend className="sr-only">Events</legend>
          {EVENTS.map(([id, labelText]) => (
            <label key={id} className="flex items-center gap-2 text-sm text-ink">
              <Checkbox checked={events.includes(id)} onCheckedChange={(v) => setEvents((es) => (v ? [...es, id] : es.filter((x) => x !== id)))} />
              {labelText}
            </label>
          ))}
        </fieldset>
        <Button type="submit" className="self-start" disabled={!url.trim() || !events.length}>
          <Icon icon={Webhook} /> Add webhook
        </Button>
      </form>
      {secret && (
        <div className="mt-4 flex flex-col gap-2 rounded-md bg-warning-soft p-3">
          <p className="text-sm text-ink">Signing secret — copy it now. Verify each request’s X-Margin-Signature with it.</p>
          <CopyField value={secret} label="Webhook signing secret" />
        </div>
      )}
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {(q.data ?? []).map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs text-ink">{w.url}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <Badge tone={w.active ? (w.failureCount ? "warning" : "success") : "danger"}>
                  {w.active ? (w.failureCount ? `${w.failureCount} recent failures` : "Active") : "Switched off"}
                </Badge>
                {w.events.join(", ")}
                {w.lastDeliveryAt && <span>· last {w.lastStatus ?? "error"} {timeAgo(w.lastDeliveryAt)}</span>}
              </p>
            </div>
            <Switch
              checked={w.active}
              aria-label={w.active ? "Switch off" : "Switch on"}
              onCheckedChange={(active) => void api.updateWebhook(w.id, { active }).then(refresh, fail)}
            />
            <Button size="sm" variant="ghost" onClick={() => void api.testWebhook(w.id).then(() => toast("Ping queued — it’ll arrive within a few seconds."), fail)}>
              <Icon icon={Send} size="xs" /> Test
            </Button>
            <Deliveries id={w.id} />
            <Button size="icon-sm" variant="ghost" aria-label="Delete webhook" onClick={() => void api.deleteWebhook(w.id).then(refresh, fail)}>
              <Icon icon={Trash2} size="xs" />
            </Button>
          </li>
        ))}
        {q.data?.length === 0 && <li className="py-3 text-sm text-ink-3">No webhooks yet.</li>}
      </ul>
    </Section>
  );
}

function Deliveries({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["deliveries", id], queryFn: () => api.deliveries(id), enabled: open, refetchInterval: open ? 5000 : false });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost">
          Log
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
          {q.data?.length === 0 && <li className="p-2 text-xs text-ink-3">Nothing sent yet.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
