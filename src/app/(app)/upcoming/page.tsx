import { localizedTitle } from "@/i18n/server";
import { UpcomingView } from "@/components/tasks/views";

export const generateMetadata = localizedTitle((t) => t.nav.upcoming);

export default function Page() {
  return <UpcomingView />;
}
