import { localizedTitle } from "@/i18n/server";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";
import { PreviewNotice } from "@/components/app/preview-notice";
import { PREVIEW } from "@/server/site";

export const generateMetadata = localizedTitle((t) => t.auth.signUpTitle);

export default function Page() {
  if (PREVIEW) return <PreviewNotice />;
  return (
    <Suspense>
      <AuthForm mode="sign-up" />
    </Suspense>
  );
}
