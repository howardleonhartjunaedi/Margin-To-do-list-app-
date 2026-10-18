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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/session-ended");
  const locale = await requestLocale((await getSettings(db, session.user.id)).locale);

  return (
    <I18nProvider locale={locale}>
      <QueryProvider>
        <UiRoot>
          <Suspense>
            <AppShell user={{ id: session.user.id, name: session.user.name, email: session.user.email }}>{children}</AppShell>
          </Suspense>
        </UiRoot>
      </QueryProvider>
    </I18nProvider>
  );
}
