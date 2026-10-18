import { localizedTitle } from "@/i18n/server";
import { PlanView } from "@/components/day/day-flows";

export const generateMetadata = localizedTitle((t) => t.day.planTitle);

export default function Page() {
  return <PlanView />;
}
