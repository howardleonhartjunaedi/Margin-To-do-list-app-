"use client";

import { CalendarDays, Inbox, LogOut, Plus, Settings, Sun } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Kbd } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { spring } from "@/design/motion";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { useCounts, useProjectActions, useProjects } from "@/lib/data";
import { projectDot } from "@/lib/project-colors";
import { useAppUI } from "./app-ui";
import { DisplaySettings } from "./display-settings";
import { NotificationsButton } from "./notifications";
import { ProjectForm } from "./project-form";

export function SidebarContent({ user, onNavigate }: { user: { name: string; email: string }; onNavigate?: () => void }) {
  const { today, openQuickAdd } = useAppUI();
  const counts = useCounts(today).data;
  const projects = useProjects();
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-6 px-3 pt-4 pb-3">
      <div className="flex items-center justify-between px-2">
        <Link href="/today" onClick={onNavigate} className="font-display text-xl font-medium tracking-tight text-ink">
          Margin<span className="text-accent">.</span>
        </Link>
      </div>

      <Button variant="primary" magnetic className="w-full justify-start" onClick={() => (onNavigate?.(), openQuickAdd())}>
        <Icon icon={Plus} /> Add task
        <Kbd className="ml-auto bg-transparent text-accent-ink/80 shadow-none ring-accent-ink/30">Q</Kbd>
      </Button>

      <nav aria-label="Views">
        <ul className="flex flex-col gap-0.5">
          <NavItem href="/inbox" icon={Inbox} label="Inbox" count={counts?.inbox} active={pathname === "/inbox"} onNavigate={onNavigate} hint="G I" />
          <NavItem
            href="/today"
            icon={Sun}
            label="Today"
            count={counts?.today}
            alert={counts?.overdue ? `${counts.overdue} overdue` : undefined}
            active={pathname === "/today"}
            onNavigate={onNavigate}
            hint="G T"
          />
          <NavItem href="/upcoming" icon={CalendarDays} label="Upcoming" active={pathname === "/upcoming"} onNavigate={onNavigate} hint="G U" />
        </ul>
      </nav>

      <section aria-labelledby="projects-h" className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
        <div className="mb-1 flex items-center justify-between px-2">
          <h2 id="projects-h" className="font-mono text-2xs tracking-wider text-ink-3 uppercase">
            Projects
          </h2>
          <NewProjectButton />
        </div>
        <ul className="flex flex-col gap-0.5">
          {projects.isPending &&
            Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="flex h-9 items-center gap-3 px-2">
                <span className="skeleton size-2 rounded-full" />
                <span className={cn("skeleton h-3", ["w-24", "w-32", "w-20"][i])} />
              </li>
            ))}
          {projects.data?.map((p) => (
            <NavItem
              key={p.id}
              href={`/project/${p.id}`}
              dot={projectDot(p.color)}
              label={p.name}
              count={p.openCount}
              active={pathname === `/project/${p.id}`}
              onNavigate={onNavigate}
            />
          ))}
          {projects.data?.length === 0 && (
            <li className="px-2 py-1 text-xs text-ink-3">Group tasks by area of life or piece of work.</li>
          )}
        </ul>
      </section>

      <div className="flex items-center gap-1 border-t border-line pt-3">
        <UserMenu user={user} />
        <div className="ml-auto flex items-center">
          <NotificationsButton />
          <Tooltip content="Settings">
            <Button asChild variant="ghost" size="icon-sm" aria-label="Settings">
              <Link href="/settings" onClick={onNavigate}>
                <Icon icon={Settings} className={pathname === "/settings" ? "text-accent" : undefined} />
              </Link>
            </Button>
          </Tooltip>
          <DisplaySettings side="top" align="end" compact />
        </div>
      </div>
    </div>
  );
}

function NavItem({
  href,
  icon,
  dot,
  label,
  count,
  alert,
  active,
  hint,
  onNavigate,
}: {
  href: string;
  icon?: typeof Inbox;
  dot?: string;
  label: string;
  count?: number;
  alert?: string;
  active: boolean;
  hint?: string;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center gap-3 rounded-md px-2 text-sm transition-colors duration-(--dur-fast)",
        active ? "text-ink" : "text-ink-2 hover:bg-sunken/60 hover:text-ink",
      )}
    >
      {active && (
        // Slides between items: shows where you went.
        <motion.span layoutId="nav-active" transition={spring.layout} className="absolute inset-0 rounded-md bg-sunken" />
      )}
      <span className="relative flex w-4 justify-center">
        {icon ? <Icon icon={icon} className={active ? "text-accent" : undefined} /> : <span className={cn("size-2 rounded-full", dot)} />}
      </span>
      <span className="relative min-w-0 flex-1 truncate">{label}</span>
      {alert && (
        <span className="relative font-mono text-2xs text-danger" title={alert}>
          {alert.split(" ")[0]}
          <span className="sr-only"> overdue</span>
        </span>
      )}
      {!!count && <span className="relative font-mono text-2xs text-ink-3">{count}</span>}
    </Link>
  );
  return <li>{hint ? <Tooltip content={label} shortcut={hint.split(" ")} side="right">{link}</Tooltip> : link}</li>;
}

function NewProjectButton() {
  const [open, setOpen] = useState(false);
  const { create } = useProjectActions();
  const router = useRouter();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="New project">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="New project">
            <Icon icon={Plus} />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent side="right" align="start" className="w-72 p-4">
        <ProjectForm
          submitLabel="Create project"
          onSubmit={async ({ name, color }) => {
            const id = crypto.randomUUID();
            setOpen(false);
            router.push(`/project/${id}`);
            await create({ id, name, color });
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function UserMenu({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="min-w-0 justify-start gap-2 px-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sunken font-mono text-2xs text-ink-2 ring-1 ring-line">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuItem
          icon={<Icon icon={LogOut} />}
          onSelect={async () => {
            await signOut();
            router.replace("/sign-in");
            router.refresh();
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
