import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingFooter, LandingHeader } from "@/components/landing/chrome";
import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { Keyboard } from "@/components/landing/keyboard";
import { TryIt } from "@/components/landing/lazy-sections";
import { Story } from "@/components/landing/story";
import { SmoothScroll } from "@/components/smooth-scroll";
import { catalogs } from "@/i18n/catalogs";
import { I18nProvider } from "@/i18n/context";
import { INTL_TAG, isLocale, LOCALES } from "@/i18n/locales";

/*
 * The front page, prerendered once per language. Visitors reach it at "/" — proxy.ts rewrites
 * to their language (chosen cookie, else Accept-Language) — or directly at /en, /id.
 * Signed-in visitors never see it: proxy.ts sends them to /today.
 */

export const dynamicParams = false;
export const generateStaticParams = () => LOCALES.map((lang) => ({ lang }));

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = catalogs[lang].landing;
  return {
    title: { absolute: t.metaTitle },
    description: t.metaDescription,
    alternates: { languages: { ...Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])), "x-default": "/" } },
  };
}

// Monday-first narrow weekday names (2024-01-01 was a Monday), for the stats scene.
const weekdaysFor = (lang: string) =>
  Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(lang, { weekday: "narrow" }).format(new Date(2024, 0, 1 + i)));

export default async function Home({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = catalogs[lang].landing;

  return (
    <I18nProvider locale={lang}>
      {/* The root layout can't know the page's language; set it before first paint. */}
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(lang)}` }} />
      <SmoothScroll />
      <a href="#main" className="sr-only z-50 rounded-md bg-raised p-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {t.skip}
      </a>
      <LandingHeader t={t} />
      <main id="main">
        <Hero t={t} />
        <Story t={t} weekdays={weekdaysFor(INTL_TAG[lang])} />
        <section id="try" aria-labelledby="try-h" className="scroll-mt-16 border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
            <h2 id="try-h" className="font-display text-3xl text-ink sm:text-4xl">
              {t.tryTitle}
            </h2>
            <p className="mt-4 mb-10 max-w-[52ch] text-base text-ink-2">{t.tryBody}</p>
            <TryIt />
          </div>
        </section>
        <section aria-labelledby="keys-h" className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
            <Keyboard t={t} />
          </div>
        </section>
        <section id="faq" aria-labelledby="faq-h" className="scroll-mt-16 border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
            <Faq t={t} />
          </div>
        </section>
      </main>
      <LandingFooter t={t} />
    </I18nProvider>
  );
}
