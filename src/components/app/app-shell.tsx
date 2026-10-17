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
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const online = useOnline();

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
        Skip to tasks
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-surface md:block" aria-label="Navigation">
        <SidebarContent user={user} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/95 px-2 md:hidden">
        <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
          <Icon icon={Menu} size="md" />
        </Button>
        <Link href="/today" className="font-display text-lg font-medium text-ink">
          Margin<span className="text-accent">.</span>
        </Link>
      </header>
      <Sheet open={navOpen} onOpenChange={setNavOpen} side="left" title="Navigation">
        <SidebarContent user={user} onNavigate={() => setNavOpen(false)} />
      </Sheet>

      <main id="main" className="md:pl-64">
        <div className="mx-auto w-full max-w-[760px] px-4 pt-6 pb-32 sm:px-8 md:pt-12">
          {!online && (
            <div className="mb-6">
              <OfflineBanner />
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Mobile primary action */}
      <Button
        variant="primary"
        size="icon"
        aria-label="Add task"
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
              toast(`Added the ${r.tasks === 1 ? "task" : `${r.tasks} tasks`} you wrote on the front page.`);
            },
            () => {},
          );
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!settings]);
  return null;
}
