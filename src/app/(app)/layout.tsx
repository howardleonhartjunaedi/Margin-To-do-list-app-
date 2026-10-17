import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { QueryProvider } from "@/components/app/query-provider";
import { getSession } from "@/server/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in?reauth=1");

  return (
    <QueryProvider>
      <Suspense>
        <AppShell user={{ name: session.user.name, email: session.user.email }}>{children}</AppShell>
      </Suspense>
    </QueryProvider>
  );
}
