import { localizedTitle } from "@/i18n/server";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";

export const generateMetadata = localizedTitle((t) => t.auth.signInTitle);

export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="sign-in" />
    </Suspense>
  );
}
