import { localizedTitle } from "@/i18n/server";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";
import { DemoNotice } from "@/components/app/demo-notice";
import { DEMO } from "@/server/site";

export const generateMetadata = localizedTitle((t) => t.auth.signUpTitle);

export default function Page() {
  if (DEMO) return <DemoNotice />;
  return (
    <Suspense>
      <AuthForm mode="sign-up" />
    </Suspense>
  );
}
