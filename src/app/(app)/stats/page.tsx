import { localizedTitle } from "@/i18n/server";
import { StatsView } from "@/components/stats/stats-view";

export const generateMetadata = localizedTitle((t) => t.nav.stats);

export default function Page() {
  return <StatsView />;
}
