import Link from "next/link";
import { Button } from "@/components/ui/button";
import { serverT } from "@/i18n/server";

/** Shown in place of the sign-up form in the browser demo, which has only the demo account. */
export async function DemoNotice() {
  const t = (await serverT()).auth.demo;
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">{t.title}</h1>
      <p className="mt-3 text-sm text-ink-2">{t.body}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="primary">
          <Link href="/sign-in">{t.cta}</Link>
        </Button>
        <Button asChild>
          <Link href="/">{t.back}</Link>
        </Button>
      </div>
    </div>
  );
}
