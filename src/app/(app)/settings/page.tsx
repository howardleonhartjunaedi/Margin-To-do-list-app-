import { localizedTitle } from "@/i18n/server";
import { SettingsView } from "@/components/app/settings-view";

export const generateMetadata = localizedTitle((t) => t.nav.settings);

export default function Page() {
  return <SettingsView />;
}
