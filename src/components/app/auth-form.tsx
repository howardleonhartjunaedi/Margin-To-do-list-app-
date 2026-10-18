"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { Field, Input } from "@/components/ui/input";
import type { Messages } from "@/i18n/catalogs";
import { useT } from "@/i18n/client";
import { signIn, signUp } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useT().auth;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rawNext = params.get("next");
  const next = rawNext?.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/today";
  const reauth = params.has("reauth");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    setPending(true);
    setError(null);
    const res =
      mode === "sign-in"
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name: String(f.get("name")).trim() || email.split("@")[0] });
    if (res.error) {
      setPending(false);
      setError(humanize(res.error, mode, t.errors));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  const signingUp = mode === "sign-up";
  return (
    <>
      <h1 className="font-display text-4xl text-ink">{signingUp ? t.startList : t.welcomeBack}</h1>
      <p className="mt-3 text-sm text-ink-2">{signingUp ? t.syncDevices : reauth ? t.sessionEnded : t.seeToday}</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        {signingUp && <Field label={t.name}>{(p) => <Input {...p} name="name" autoComplete="name" placeholder={t.namePlaceholder} />}</Field>}
        <Field label={t.email}>{(p) => <Input {...p} name="email" type="email" required autoComplete="email" inputMode="email" />}</Field>
        <Field label={t.password} hint={signingUp ? t.passwordHint : undefined}>
          {(p) => (
            <Input {...p} name="password" type="password" required minLength={8} autoComplete={signingUp ? "new-password" : "current-password"} />
          )}
        </Field>
        {error && <ErrorState message={error} />}
        <Button type="submit" variant="primary" size="lg" disabled={pending} magnetic>
          {pending ? (signingUp ? t.creating : t.signingIn) : signingUp ? t.createAccount : t.signIn}
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink-2">
        {signingUp ? t.haveAccount : t.newHere}
        <Link
          href={`${signingUp ? "/sign-in" : "/sign-up"}${next !== "/today" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-accent underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          {signingUp ? t.signIn : t.createAnAccount}
        </Link>
      </p>
    </>
  );
}

function humanize(err: { code?: string; message?: string; status?: number }, mode: string, t: Messages["auth"]["errors"]) {
  switch (err.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return t.mismatch;
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return t.exists;
    case "PASSWORD_TOO_SHORT":
      return t.short;
    case "INVALID_EMAIL":
      return t.email;
  }
  if (err.status === 429) return t.rate;
  return err.message ?? (mode === "sign-in" ? t.signIn : t.signUp);
}
