import { localizedTitle, serverT } from "@/i18n/server";
import Link from "next/link";
import { AcceptInvite } from "@/components/sharing/accept-invite";
import { Button } from "@/components/ui/button";
import { getSession } from "@/server/auth";
import { describeInvite } from "@/server/sharing";
import { projectRole } from "@/server/access";
import { db } from "@/server/db";

export const generateMetadata = localizedTitle((t) => t.invite.title);

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession(); // also makes sure the database is ready
  const invite = await describeInvite(token);
  const alreadyIn = session && invite ? (await projectRole(db, session.user.id, invite.projectId)) !== null : false;
  const next = encodeURIComponent(`/invite/${token}`);
  const tr = await serverT();
  const t = tr.invite;

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6 sm:px-8">
      <Link href="/" className="font-display text-xl font-medium tracking-tight text-ink">
        Margin<span className="text-accent">.</span>
      </Link>
      <main className="flex flex-1 flex-col justify-center py-12">
        {!invite ? (
          <>
            <h1 className="font-display text-4xl text-ink">{t.missing}</h1>
            <p className="mt-3 text-base text-ink-2">{t.missingBody}</p>
          </>
        ) : invite.status !== "open" ? (
          <>
            <h1 className="font-display text-4xl text-ink">{invite.status === "expired" ? t.expired : t.used}</h1>
            <p className="mt-3 text-base text-ink-2">{t.askFor(invite.inviter, invite.projectName)}</p>
            {session && (
              <Button asChild variant="ghost" className="mt-6 self-start">
                <Link href={`/project/${invite.projectId}`}>{t.openIfIn}</Link>
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="font-mono text-2xs tracking-wider text-ink-3 uppercase">{t.title}</p>
            <h1 className="mt-3 font-display text-4xl text-ink">
              {t.invitedYou(
                invite.inviter,
                <em key="p" className="text-accent">
                  {invite.projectName}
                </em>,
              )}
            </h1>
            <p className="mt-3 text-base text-ink-2">
              {t.joinAs(tr.share.roles[invite.role as keyof typeof tr.share.roles] ?? invite.role)}
              {invite.email ? t.forEmail(invite.email) : ""}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {alreadyIn ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-ink-2">{t.alreadyMember}</p>
                  <Button asChild variant="primary" size="lg" className="self-start">
                    <Link href={`/project/${invite.projectId}`}>{t.open}</Link>
                  </Button>
                </div>
              ) : session ? (
                <AcceptInvite token={token} signedInAs={session.user.email} />
              ) : (
                <>
                  <Button asChild variant="primary" size="lg">
                    <Link href={`/sign-in?next=${next}`}>{t.signInToAccept}</Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg">
                    <Link href={`/sign-up?next=${next}`}>{t.createAccount}</Link>
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
