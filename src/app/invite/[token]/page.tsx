import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvite } from "@/components/sharing/accept-invite";
import { Button } from "@/components/ui/button";
import { getSession } from "@/server/auth";
import { describeInvite } from "@/server/sharing";
import { projectRole } from "@/server/access";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession(); // also makes sure the database is ready
  const invite = await describeInvite(token);
  const alreadyIn = session && invite ? (await projectRole(db, session.user.id, invite.projectId)) !== null : false;
  const next = encodeURIComponent(`/invite/${token}`);

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6 sm:px-8">
      <Link href="/" className="font-display text-xl font-medium tracking-tight text-ink">
        Margin<span className="text-accent">.</span>
      </Link>
      <main className="flex flex-1 flex-col justify-center py-12">
        {!invite ? (
          <>
            <h1 className="font-display text-4xl text-ink">This invitation doesn’t exist.</h1>
            <p className="mt-3 text-base text-ink-2">The link may be mistyped, or it was revoked. Ask whoever shared it for a new one.</p>
          </>
        ) : invite.status !== "open" ? (
          <>
            <h1 className="font-display text-4xl text-ink">{invite.status === "expired" ? "This invitation has expired." : "This invitation was already used."}</h1>
            <p className="mt-3 text-base text-ink-2">Ask {invite.inviter} for a new link to “{invite.projectName}”.</p>
            {session && (
              <Button asChild variant="ghost" className="mt-6 self-start">
                <Link href={`/project/${invite.projectId}`}>Open the project, if you’re already in it</Link>
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="font-mono text-2xs tracking-wider text-ink-3 uppercase">Invitation</p>
            <h1 className="mt-3 font-display text-4xl text-ink">
              {invite.inviter} invited you to <em className="text-accent">{invite.projectName}</em>.
            </h1>
            <p className="mt-3 text-base text-ink-2">
              You’ll join as {/^[aeiou]/.test(invite.role) ? "an" : "a"} {invite.role}.{invite.email ? ` This invitation is for ${invite.email}.` : ""}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {alreadyIn ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-ink-2">You’re already a member, so this link is still unused for whoever it’s meant for.</p>
                  <Button asChild variant="primary" size="lg" className="self-start">
                    <Link href={`/project/${invite.projectId}`}>Open the project</Link>
                  </Button>
                </div>
              ) : session ? (
                <AcceptInvite token={token} signedInAs={session.user.email} />
              ) : (
                <>
                  <Button asChild variant="primary" size="lg">
                    <Link href={`/sign-in?next=${next}`}>Sign in to accept</Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg">
                    <Link href={`/sign-up?next=${next}`}>Create an account</Link>
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
