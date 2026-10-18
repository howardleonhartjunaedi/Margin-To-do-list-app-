import { localizedTitle } from "@/i18n/server";
import { HabitsView } from "@/components/habits/habits-view";

export const generateMetadata = localizedTitle((t) => t.nav.habits);

export default function Page() {
  return <HabitsView />;
}
