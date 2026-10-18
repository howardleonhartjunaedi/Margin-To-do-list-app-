import { localizedTitle } from "@/i18n/server";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";

export const generateMetadata = localizedTitle((t) => t.auth.signUpTitle);

export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="sign-up" />
    </Suspense>
  );
}
