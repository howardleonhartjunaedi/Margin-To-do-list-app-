import Link from "next/link";
import { Button } from "@/components/ui/button";
import { serverT } from "@/i18n/server";

/** Shown in place of the sign-in and sign-up forms on a preview build (no database). */
export async function PreviewNotice() {
  const t = (await serverT()).auth.preview;
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">{t.title}</h1>
      <p className="mt-3 text-sm text-ink-2">{t.body}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="primary">
          <Link href="/#try">{t.tryIt}</Link>
        </Button>
        <Button asChild>
          <Link href="/">{t.back}</Link>
        </Button>
      </div>
    </div>
  );
}
