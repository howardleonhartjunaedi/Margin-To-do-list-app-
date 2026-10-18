import { UiRoot } from "@/components/providers/ui-root";
import { I18nProvider } from "@/i18n/client";
import { requestLocale } from "@/i18n/server";

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider locale={await requestLocale()}>
      <UiRoot>{children}</UiRoot>
    </I18nProvider>
  );
}
