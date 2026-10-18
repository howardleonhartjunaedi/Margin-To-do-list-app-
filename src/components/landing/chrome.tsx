import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/i18n/catalogs";
import { LanguageSwitch } from "./language-switch";

type T = Messages["landing"];

function Wordmark() {
  return (
    <Link href="/" className="font-display text-xl font-medium tracking-tight text-ink">
      Margin<span className="text-accent">.</span>
    </Link>
  );
}

export function LandingHeader({ t }: { t: T }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-8">
        <Wordmark />
        <nav aria-label={t.sections} className="hidden items-center gap-6 text-sm text-ink-2 md:flex">
          <a href="#features" className="hover:text-ink">
            {t.features}
          </a>
          <a href="#try" className="hover:text-ink">
            {t.tryIt}
          </a>
          <a href="#faq" className="hover:text-ink">
            {t.faq}
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">{t.signIn}</Link>
          </Button>
          <Button asChild variant="primary" size="sm" className="max-[379px]:hidden">
            <Link href="/sign-up">{t.createAccount}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function LandingFooter({ t }: { t: T }) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-[36ch] text-sm text-ink-2">{t.tagline}</p>
          <div className="mt-6">
            <LanguageSwitch label={t.language} />
          </div>
        </div>
        <nav aria-label={t.product} className="flex flex-col gap-2 text-sm">
          <p className="mb-1 font-mono text-2xs tracking-wider text-ink-3 uppercase">{t.product}</p>
          <a href="#features" className="text-ink-2 hover:text-ink">
            {t.features}
          </a>
          <a href="#try" className="text-ink-2 hover:text-ink">
            {t.tryIt}
          </a>
          <Link href="/sign-up" className="text-ink-2 hover:text-ink">
            {t.createAccount}
          </Link>
        </nav>
        <nav aria-label={t.resources} className="flex flex-col gap-2 text-sm">
          <p className="mb-1 font-mono text-2xs tracking-wider text-ink-3 uppercase">{t.resources}</p>
          <Link href="/developers" className="text-ink-2 hover:text-ink">
            {t.apiWebhooks}
          </Link>
          <Link href="/styleguide" className="text-ink-2 hover:text-ink">
            {t.styleGuide}
          </Link>
          <Link href="/sign-in" className="text-ink-2 hover:text-ink">
            {t.signIn}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
