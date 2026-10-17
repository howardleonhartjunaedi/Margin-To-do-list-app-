"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { Field, Input } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/today";
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
      setError(humanize(res.error, mode));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  const signingUp = mode === "sign-up";
  return (
    <>
      <h1 className="font-display text-4xl text-ink">{signingUp ? "Start a clean list." : "Welcome back."}</h1>
      <p className="mt-3 text-sm text-ink-2">
        {signingUp ? "An account keeps your tasks in sync across devices." : reauth ? "Your session ended. Sign in to pick up where you left off." : "Sign in to see what’s on today."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        {signingUp && <Field label="Name">{(p) => <Input {...p} name="name" autoComplete="name" placeholder="Sam Rivera" />}</Field>}
        <Field label="Email">{(p) => <Input {...p} name="email" type="email" required autoComplete="email" inputMode="email" />}</Field>
        <Field label="Password" hint={signingUp ? "At least 8 characters." : undefined}>
          {(p) => (
            <Input {...p} name="password" type="password" required minLength={8} autoComplete={signingUp ? "new-password" : "current-password"} />
          )}
        </Field>
        {error && <ErrorState message={error} />}
        <Button type="submit" variant="primary" size="lg" disabled={pending} magnetic>
          {pending ? (signingUp ? "Creating your account…" : "Signing in…") : signingUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink-2">
        {signingUp ? "Already have an account? " : "New here? "}
        <Link
          href={`${signingUp ? "/sign-in" : "/sign-up"}${next !== "/today" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-accent underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          {signingUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </>
  );
}

function humanize(err: { code?: string; message?: string; status?: number }, mode: string) {
  switch (err.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don’t match. Check for typos and try again.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "There’s already an account with that email. Sign in instead?";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters for your password.";
    case "INVALID_EMAIL":
      return "That email address doesn’t look right.";
  }
  if (err.status === 429) return "Too many attempts. Wait a minute, then try again.";
  return err.message ?? (mode === "sign-in" ? "Couldn’t sign you in. Try again." : "Couldn’t create your account. Try again.");
}
