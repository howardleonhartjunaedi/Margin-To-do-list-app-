"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Clock, MessageSquare, Newspaper, UserCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { spring } from "@/design/motion";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { keys, snoozeReminder, useNotifications } from "@/lib/data";
import { timeAgo } from "@/lib/dates";
import { pushState } from "@/lib/push";
import type { Notification } from "@/lib/types";
import { useAppUI } from "./app-ui";
import { useT } from "@/i18n/client";
import { m } from "@/i18n/catalogs";

const SNOOZE = [{ minutes: 10 }, { minutes: 60 }, { minutes: 180 }, { tomorrowAt: "09:00" }] as const;

/** Snooze options with their labels in the language on screen. */
export const snoozeChoices = () => SNOOZE.map((choice, i) => ({ ...m().notif.snoozeChoices[i], choice }));

async function completeFromNotification(n: Notification, qc: ReturnType<typeof useQueryClient>) {
  if (!n.taskId) return;
  try {
    await api.updateTask(n.taskId, { completed: true });
    toast(m().tasks.completed(n.title));
  } catch (e) {
    toast((e as Error).message);
  }
  qc.invalidateQueries({ queryKey: ["tasks"] });
  qc.invalidateQueries({ queryKey: ["counts"] });
  qc.invalidateQueries({ queryKey: keys.notifications });
}

/**
 * Watches for new notifications and shows each once as a toast — unless this device
 * already gets system push, which would make it a duplicate.
 */
export function NotificationWatcher() {
  const { data } = useNotifications();
  const qc = useQueryClient();
  const { openTask } = useAppUI();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    if (!seen.current) {
      seen.current = new Set(data.items.map((n) => n.id)); // first load: history, not news
      return;
    }
    const fresh = data.items.filter((n) => !seen.current!.has(n.id) && !n.read);
    fresh.forEach((n) => seen.current!.add(n.id));
    if (!fresh.length) return;
    void pushState().then((state) => {
      if (state === "on" && document.visibilityState !== "visible") return;
      for (const n of fresh.slice(0, 3)) {
        toast(n.title, {
          description: n.body,
          duration: n.kind === "reminder" ? 15_000 : 8_000,
          action: n.taskId && n.kind === "reminder" ? { label: m().notif.done, onClick: () => void completeFromNotification(n, qc) } : undefined,
          cancel: n.reminderId
            ? { label: m().notif.snooze, onClick: () => void snoozeReminder(n.reminderId!, { minutes: 10 }, m().notif.snoozeChoices[0].short) }
            : n.taskId
              ? { label: m().notif.open, onClick: () => openTask(n.taskId!) }
              : undefined,
        });
      }
    });
  }, [data, openTask, qc]);

  return null;
}

export function NotificationsButton() {
  const { data } = useNotifications();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const unread = data?.unread ?? 0;

  // Opening the inbox reads it.
  useEffect(() => {
    if (!open || !unread) return;
    const t = setTimeout(async () => {
      qc.setQueryData(keys.notifications, await api.markRead("all").catch(() => data));
    }, 1200);
    return () => clearTimeout(t);
  }, [open, unread, qc, data]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={unread ? m().notif.unread(unread) : m().notif.title} className="relative">
          <Icon icon={Bell} />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={spring.pop}
                className="absolute top-0 right-0 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-2xs leading-none text-accent-ink"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-[min(360px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-display text-lg">{m().notif.title}</h2>
        </div>
        <Inbox items={data?.items} onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function Inbox({ items, onNavigate }: { items?: Notification[]; onNavigate: () => void }) {
  const qc = useQueryClient();
  const { openTask } = useAppUI();
  const t = useT().notif;
  if (!items) return <div className="skeleton m-4 h-16" />;
  if (!items.length)
    return (
      <div className="px-4 py-8">
        <p className="font-display text-lg text-ink">{t.empty}</p>
        <p className="mt-1 text-sm text-ink-2">{t.emptyBody}</p>
      </div>
    );
  return (
    <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto" data-lenis-prevent>
      {items.map((n) => (
        <li key={n.id} className={cn("flex gap-3 px-4 py-3", !n.read && "bg-accent-soft/40")}>
          <Icon icon={n.kind === "digest" ? Newspaper : n.kind === "comment" ? MessageSquare : n.kind === "assigned" ? UserCheck : Clock} className="mt-0.5 text-ink-3" />
          <div className="min-w-0 flex-1">
            <button
              className={cn("block text-left text-sm", n.taskDone ? "text-ink-3 line-through" : "text-ink", n.taskId && "hover:underline")}
              onClick={() => {
                if (!n.taskId) return;
                onNavigate();
                openTask(n.taskId);
              }}
            >
              {n.title}
            </button>
            {n.body && <p className="mt-0.5 text-xs whitespace-pre-line text-ink-2">{n.body}</p>}
            <p className="mt-1 font-mono text-2xs text-ink-3">{timeAgo(n.createdAt)}</p>
            {n.kind === "reminder" && n.taskId && !n.taskDone && (
              <div className="mt-2 flex gap-1">
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => void completeFromNotification(n, qc)}>
                  <Icon icon={Check} size="xs" /> {t.done}
                </Button>
                {n.reminderId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                        {t.snooze}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {snoozeChoices().map((c) => (
                        <DropdownMenuItem key={c.label} onSelect={() => void snoozeReminder(n.reminderId!, c.choice, c.short)}>
                          {c.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
