"use client";

import { Menu, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { OfflineBanner } from "@/components/ui/states";
import { QuickAddDialog } from "@/components/tasks/quick-add";
import { TaskDetailSheet } from "@/components/tasks/task-detail";
import { useHotkeys } from "@/lib/use-hotkeys";
import { AppUIProvider, useAppUI } from "./app-ui";
import { SidebarContent } from "./sidebar";
import { NotificationWatcher } from "./notifications";
import { CommandPalette } from "./command-palette";
import { Realtime } from "./realtime";
import { FocusProvider } from "@/components/focus/focus-provider";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { setCurrentUserId, useSettings, useSettingsActions } from "@/lib/data";
import { refreshPushSubscription } from "@/lib/push";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useT } from "@/i18n/client";
import { m } from "@/i18n/catalogs";
import { flushOutbox, pendingOps, useOutboxSize } from "@/lib/outbox";
import { ensureServiceWorker } from "@/lib/sw";
import { replayOutbox, resetOfflineNotice } from "@/lib/data";
import { currentLocale } from "@/i18n/runtime";
import { rememberLocale } from "@/i18n/cookie";

type User = { id: string; name: string; email: string };

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  setCurrentUserId(user.id);
  return (
    <AppUIProvider>
      <FocusProvider>
        <Shell user={user}>{children}</Shell>
      </FocusProvider>
    </AppUIProvider>
  );
}

function Shell({ user, children }: { user: User; children: React.ReactNode }) {
  const { openQuickAdd, openPalette, setShortcutsOpen } = useAppUI();
  const t = useT();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const online = useOnline();
  const pending = useOutboxSize();

  useHotkeys({
    q: () => openQuickAdd(),
    "g i": () => router.push("/inbox"),
    "g t": () => router.push("/today"),
    "g u": () => router.push("/upcoming"),
    "g c": () => router.push("/upcoming?layout=calendar"),
    "g s": () => router.push("/settings"),
    "g f": () => router.push("/focus"),
    "g h": () => router.push("/habits"),
    "/": () => openPalette(),
    "?": () => setShortcutsOpen(true),
  });

  // ⌘K / Ctrl+K works even while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette]);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-md bg-raised p-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {t.nav.skipToTasks}
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-surface md:block" aria-label={t.nav.navigation}>
        <SidebarContent user={user} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/95 px-2 md:hidden">
        <Button variant="ghost" size="icon" aria-label={t.nav.openNavigation} onClick={() => setNavOpen(true)}>
          <Icon icon={Menu} size="md" />
        </Button>
        <Link href="/today" className="font-display text-lg font-medium text-ink">
          Margin<span className="text-accent">.</span>
        </Link>
      </header>
      <Sheet open={navOpen} onOpenChange={setNavOpen} side="left" title={t.nav.navigation}>
        <SidebarContent user={user} onNavigate={() => setNavOpen(false)} />
      </Sheet>

      <main id="main" className="md:pl-64">
        <div className="mx-auto w-full max-w-[760px] px-4 pt-6 pb-32 sm:px-8 md:pt-12">
          {(!online || pending > 0) && (
            <div className="mb-6">
              <OfflineBanner pending={pending} online={online} />
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Mobile primary action */}
      <Button
        variant="primary"
        size="icon"
        aria-label={t.nav.addTask}
        onClick={() => openQuickAdd()}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-3 md:hidden"
      >
        <Icon icon={Plus} size="lg" />
      </Button>

      <QuickAddDialog />
      <TaskDetailSheet />
      <NotificationWatcher />
      <Realtime />
      <CommandPalette />
      <ShortcutsDialog />
      <FirstRunSync />
      <OfflineSync />
    </div>
  );
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * On first use, adopt this device's time zone (so "9am" means the user's 9am),
 * and keep any existing push subscription registered with the server.
 */
function FirstRunSync() {
  const settings = useSettings().data;
  const save = useSettingsActions();
  const qc = useQueryClient();
  useEffect(() => {
    if (!settings) return;
    const key = "margin:tz-adopted";
    try {
      if (!localStorage.getItem(key)) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && tz !== settings.timeZone) void save({ timeZone: tz });
        localStorage.setItem(key, "1");
      }
      // Adopt the language this browser asked for, so emails and reminders match the app.
      if (settings.locale === null && !localStorage.getItem("margin:locale-adopted")) {
        void save({ locale: currentLocale() });
        rememberLocale(currentLocale());
        localStorage.setItem("margin:locale-adopted", "1");
      }
    } catch {}
    void refreshPushSubscription();
    // Tasks typed into the landing-page demo before signing up: bring them in once.
    try {
      const demo = localStorage.getItem("margin:demo-tasks");
      if (demo !== null) {
        localStorage.removeItem("margin:demo-tasks");
        if (demo.trim())
          void api.importData({ format: "text", content: demo }).then(
            (r) => {
              qc.invalidateQueries();
              toast(m().common.importedFromFrontPage(r.tasks));
            },
            () => {},
          );
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!settings]);
  return null;
}

/**
 * Keeps this device usable offline: registers the service worker (which keeps pages and data
 * readable), and replays changes queued while offline as soon as the network is back.
 */
function OfflineSync() {
  const qc = useQueryClient();
  useEffect(() => {
    void ensureServiceWorker();
    const sync = async () => {
      if (!navigator.onLine) return;
      resetOfflineNotice();
      const { sent, failed } = await flushOutbox();
      if (sent || failed) qc.invalidateQueries();
      if (sent) toast(m().common.synced(sent));
      if (failed) toast(m().common.syncFailed(failed));
    };
    void sync();
    window.addEventListener("online", sync);
    // The browser can think it's online while the server is unreachable: keep retrying quietly.
    const retry = setInterval(() => pendingOps().length && void sync(), 30_000);
    // Fetched data predates anything still queued: lay the queued changes back on top.
    const unsubscribe = qc.getQueryCache().subscribe((e) => {
      if (e.type === "updated" && e.action.type === "success" && !e.action.manual && e.query.queryKey[0] === "tasks" && pendingOps().length)
        replayOutbox(qc, [...pendingOps()]);
    });
    return () => {
      window.removeEventListener("online", sync);
      clearInterval(retry);
      unsubscribe();
    };
  }, [qc]);
  return null;
}
