import { localizedTitle } from "@/i18n/server";
import { InboxView } from "@/components/tasks/views";

export const generateMetadata = localizedTitle((t) => t.nav.inbox);

export default function Page() {
  return <InboxView />;
}
