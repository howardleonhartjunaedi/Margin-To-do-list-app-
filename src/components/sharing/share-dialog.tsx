"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, LogOut, UserPlus, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { getCurrentUserId } from "@/lib/data";
import type { Member, Role } from "@/lib/types";
import { useT } from "@/i18n/client";
import { m } from "@/i18n/catalogs";

const label = (r: Role) => m().share.roles[r];
const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : m().share.tryAgain);

export const useMembers = (projectId: string | null | undefined, enabled = true) =>
  useQuery({ queryKey: ["members", projectId], queryFn: () => api.members(projectId!), enabled: !!projectId && enabled, staleTime: 60_000 });

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-7 shrink-0 place-items-center rounded-full bg-sunken font-mono text-2xs text-ink-2 ring-2 ring-bg", className)}
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

export function ShareButton({ projectId, projectName, memberCount }: { projectId: string; projectName: string; memberCount: number }) {
  const [open, setOpen] = useState(false);
  const q = useMembers(projectId, open || memberCount > 1);
  const others = (q.data?.members ?? []).slice(0, 3);
  const t = useT().share;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={memberCount > 1 ? t.sharedWith(memberCount - 1) : t.shareProject}>
          {memberCount > 1 && others.length ? (
            <span className="flex -space-x-2">
              {others.map((m) => (
                <Avatar key={m.userId} name={m.name} className="size-6" />
              ))}
            </span>
          ) : (
            <Icon icon={Users} />
          )}
          {t.share}
        </Button>
      </DialogTrigger>
      <DialogContent title={t.title(projectName)} description={t.description} className="max-w-lg">
        {q.data ? <ShareBody projectId={projectId} data={q.data} onLeft={() => setOpen(false)} /> : <div className="skeleton h-24" />}
      </DialogContent>
    </Dialog>
  );
}

function ShareBody({ projectId, data, onLeft }: { projectId: string; data: Awaited<ReturnType<typeof api.members>>; onLeft: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const isOwner = data.myRole === "owner";
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "owner">>("editor");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["members", projectId] });
  const t = useT().share;

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex flex-col gap-6">
      {isOwner && (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!email.trim()) return;
            try {
              await api.invite(projectId, { email: email.trim(), role });
              toast(t.inviteSent(email.trim()));
              setEmail("");
              refresh();
            } catch (err) {
              fail(err);
            }
          }}
        >
          <label htmlFor="invite-email" className="text-sm font-medium text-ink">
            {t.inviteByEmail}
          </label>
          <div className="flex flex-wrap gap-2">
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sam@example.com" className="min-w-0 flex-1" />
            <RoleSelect value={role} onChange={setRole} />
            <Button type="submit" variant="primary" disabled={!email.trim()}>
              <Icon icon={UserPlus} /> {t.invite}
            </Button>
          </div>
          <p className="text-xs text-ink-3">{t.linkRule(t.roleHints[role])}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {link ? (
              <>
                <code className="min-w-0 flex-1 truncate rounded-sm bg-sunken px-2 py-1.5 font-mono text-2xs text-ink-2">{link}</code>
                <Button type="button" size="sm" onClick={() => void copy(link)}>
                  <Icon icon={copied ? Check : Copy} size="xs" /> {copied ? t.copied : t.copy}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    const r = await api.invite(projectId, { role });
                    setLink(r.url);
                    void copy(r.url);
                    refresh();
                  } catch (err) {
                    fail(err);
                  }
                }}
              >
                <Icon icon={Link2} size="xs" /> {t.oneTimeLink}
              </Button>
            )}
          </div>
        </form>
      )}

      <section aria-label={t.members}>
        <h3 className="mb-2 font-mono text-2xs tracking-wider text-ink-3 uppercase">{t.people}</h3>
        <ul className="divide-y divide-line border-y border-line">
          {data.members.map((m) => (
            <MemberRow key={m.userId} m={m} projectId={projectId} canManage={isOwner && m.role !== "owner"} onChange={refresh} />
          ))}
          {data.invites.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
              <Avatar name={i.email ?? "?"} className="opacity-60" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-ink-2">{i.email ?? t.inviteLink}</p>
                <p className="text-xs text-ink-3">{t.invitedAs(label(i.role).toLowerCase())}</p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t.revoke}
                onClick={async () => {
                  await api.revokeInvite(i.id).then(refresh, fail);
                  if (link === i.url) setLink(null);
                }}
              >
                <Icon icon={X} size="xs" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {!isOwner && (
        <Button
          variant="ghost"
          className="self-start text-danger hover:bg-danger-soft hover:text-danger"
          onClick={async () => {
            try {
              await api.removeMember(projectId, getCurrentUserId());
              onLeft();
              qc.invalidateQueries();
              router.push("/inbox");
              toast(t.left);
            } catch (err) {
              fail(err);
            }
          }}
        >
          <Icon icon={LogOut} /> {t.leave}
        </Button>
      )}
    </div>
  );
}

function MemberRow({ m, projectId, canManage, onChange }: { m: Member; projectId: string; canManage: boolean; onChange: () => void }) {
  const t = useT().share;
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <Avatar name={m.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-ink">{m.name}</p>
        <p className="truncate text-xs text-ink-3">{m.email}</p>
      </div>
      {canManage ? (
        <>
          <RoleSelect value={m.role as Exclude<Role, "owner">} onChange={(r) => void api.setRole(projectId, m.userId, r).then(onChange, fail)} />
          <Button size="icon-sm" variant="ghost" aria-label={t.remove(m.name)} onClick={() => void api.removeMember(projectId, m.userId).then(onChange, fail)}>
            <Icon icon={X} size="xs" />
          </Button>
        </>
      ) : (
        <span className="text-xs text-ink-2">{label(m.role)}</span>
      )}
    </li>
  );
}

function RoleSelect({ value, onChange }: { value: Exclude<Role, "owner">; onChange: (r: Exclude<Role, "owner">) => void }) {
  const t = useT().share;
  return (
    <select
      aria-label={t.role}
      value={value}
      onChange={(e) => onChange(e.target.value as Exclude<Role, "owner">)}
      title={t.roleHints[value]}
      className="h-10 rounded-md bg-raised px-2 text-sm text-ink ring-1 ring-control ring-inset"
    >
      {(["editor", "commenter", "viewer"] as const).map((r) => (
        <option key={r} value={r}>
          {label(r)}
        </option>
      ))}
    </select>
  );
}
