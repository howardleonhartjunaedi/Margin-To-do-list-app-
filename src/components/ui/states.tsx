"use client";

import { CloudOff, RotateCw } from "lucide-react";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Icon } from "./icon";

/** Loading placeholder: the shape of what's coming, never a spinner. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-4", className)} />;
}

export function TaskRowSkeleton({ rows = 4 }: { rows?: number }) {
  const widths = ["w-2/3", "w-1/2", "w-3/4", "w-2/5", "w-3/5"];
  const t = useT().common;
  return (
    <div role="status" aria-label={t.loadingTasks} className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className={cn("h-3.5", widths[i % widths.length])} />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  /** A small typographic mark, not an illustration — keeps the editorial tone. */
  mark?: string;
  className?: string;
}

/** Left-aligned, quiet, specific. Says what this place is for and the one thing to do next. */
export function EmptyState({ title, body, action, mark = "§", className }: EmptyStateProps) {
  return (
    <div className={cn("flex max-w-sm flex-col items-start gap-3 py-10", className)}>
      <span aria-hidden className="font-display text-4xl text-ink-3 italic">
        {mark}
      </span>
      <h2 className="font-display text-xl font-medium text-ink">{title}</h2>
      {body && <p className="text-sm text-ink-2">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT().common;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-danger-soft px-4 py-3 text-sm text-ink">
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry} className="text-ink hover:bg-raised">
          <Icon icon={RotateCw} /> {t.tryAgain}
        </Button>
      )}
    </div>
  );
}

/** Offline, or online with changes still waiting to reach the server (it may be unreachable). */
export function OfflineBanner({ pending = 0, online = false }: { pending?: number; online?: boolean }) {
  const t = useT().common;
  return (
    <div role="status" className="flex items-center gap-3 rounded-md bg-sunken px-4 py-2.5 text-sm text-ink-2">
      <Icon icon={CloudOff} />
      <span>
        {online ? t.unreachable : t.offline}
        {pending > 0 && <span className="ml-1 font-mono text-xs text-ink-3">· {t.waiting(pending)}</span>}
      </span>
    </div>
  );
}
