import Link from "next/link";
import { UiRoot } from "@/components/providers/ui-root";
import { I18nProvider } from "@/i18n/client";
import { requestLocale, serverT } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await requestLocale();
  const [line1, line2, doIt, rest] = (await serverT()).auth.aside;
  return (
    <I18nProvider locale={locale}>
      <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,1.1fr)]">
        <div className="flex flex-col px-4 py-6 sm:px-10">
          <Link href="/" className="font-display text-xl font-medium tracking-tight text-ink">
            Margin<span className="text-accent">.</span>
          </Link>
          <main className="flex flex-1 items-center py-12">
            <div className="w-full max-w-sm">
              <UiRoot>{children}</UiRoot>
            </div>
          </main>
        </div>
        <aside aria-hidden className="hidden border-l border-line bg-surface lg:flex lg:flex-col lg:justify-end lg:p-16">
          <ol className="font-display text-3xl leading-tight text-ink-3">
            <li className="text-ink">{line1}</li>
            <li>{line2}</li>
            <li>
              <span className="line-through decoration-accent decoration-2">{doIt}</span>
              {rest}
            </li>
          </ol>
        </aside>
      </div>
    </I18nProvider>
  );
}
