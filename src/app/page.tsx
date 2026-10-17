import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "@/components/landing/chrome";
import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { Keyboard } from "@/components/landing/keyboard";
import { Story } from "@/components/landing/story";
import { TryIt } from "@/components/landing/try-it";
import { SmoothScroll } from "@/components/smooth-scroll";

export const metadata: Metadata = {
  title: "Margin — a calm task manager",
  description: "Type a task the way you’d say it. Margin files it under the right day and reminds you at the right moment.",
};

// Signed-in visitors never see this: proxy.ts sends them to /today.
export default function Home() {
  return (
    <>
      <SmoothScroll />
      <a href="#main" className="sr-only z-50 rounded-md bg-raised p-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <LandingHeader />
      <main id="main">
        <Hero />
        <Story />
        <section id="try" aria-labelledby="try-h" className="scroll-mt-16 border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
            <h2 id="try-h" className="font-display text-3xl text-ink sm:text-4xl">
              Try it here. No account needed.
            </h2>
            <p className="mt-4 mb-10 max-w-[52ch] text-base text-ink-2">
              This is the same quick add you get in the app, running in your browser. Nothing is sent anywhere until you decide to keep it.
            </p>
            <TryIt />
          </div>
        </section>
        <section aria-labelledby="keys-h" className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
            <Keyboard />
          </div>
        </section>
        <section id="faq" aria-labelledby="faq-h" className="scroll-mt-16 border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
            <Faq />
          </div>
        </section>
      </main>
      <LandingFooter />
    </>
  );
}
