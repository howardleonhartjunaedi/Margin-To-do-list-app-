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

type User = { name: string; email: string };

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <AppUIProvider>
      <Shell user={user}>{children}</Shell>
    </AppUIProvider>
  );
}

function Shell({ user, children }: { user: User; children: React.ReactNode }) {
  const { openQuickAdd } = useAppUI();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const online = useOnline();

  useHotkeys({
    q: () => openQuickAdd(),
    "g i": () => router.push("/inbox"),
    "g t": () => router.push("/today"),
    "g u": () => router.push("/upcoming"),
  });

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
