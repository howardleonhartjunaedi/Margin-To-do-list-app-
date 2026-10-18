import { localizedTitle } from "@/i18n/server";
import { FocusView } from "@/components/focus/focus-view";

export const generateMetadata = localizedTitle((t) => t.nav.focus);

export default function Page() {
  return <FocusView />;
}
