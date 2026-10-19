import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { QueryProvider } from "@/components/app/query-provider";
import { UiRoot } from "@/components/providers/ui-root";
import { I18nProvider } from "@/i18n/client";
import { requestLocale } from "@/i18n/server";
import { getSession } from "@/server/auth";
import { db } from "@/server/db";
import { getSettings } from "@/server/reminders";
import { DEMO } from "@/server/site";
import { DEMO_USER } from "@/demo/user";
import type { Locale } from "@/i18n/locales";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The demo's data lives in the visitor's browser (src/demo); the proxy already checked its cookie.
  if (DEMO) return <Shell user={DEMO_USER} locale={await requestLocale()}>{children}</Shell>;

  const session = await getSession();
  if (!session) redirect("/session-ended");
  const locale = await requestLocale((await getSettings(db, session.user.id)).locale);
  return (
    <Shell user={{ id: session.user.id, name: session.user.name, email: session.user.email }} locale={locale}>
      {children}
    </Shell>
  );
}

function Shell({ user, locale, children }: { user: { id: string; name: string; email: string }; locale: Locale; children: React.ReactNode }) {

  return (
    <I18nProvider locale={locale}>
      <QueryProvider>
        <UiRoot>
          <Suspense>
            <AppShell user={user}>{children}</AppShell>
          </Suspense>
        </UiRoot>
      </QueryProvider>
    </I18nProvider>
  );
}
