import { localizedTitle } from "@/i18n/server";
import { TodayView } from "@/components/tasks/views";

export const generateMetadata = localizedTitle((t) => t.nav.today);

export default function Page() {
  return <TodayView />;
}
