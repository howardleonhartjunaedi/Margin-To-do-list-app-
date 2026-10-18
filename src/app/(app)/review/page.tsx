import { localizedTitle } from "@/i18n/server";
import { ReviewView } from "@/components/day/day-flows";

export const generateMetadata = localizedTitle((t) => t.day.reviewTitle);

export default function Page() {
  return <ReviewView />;
}
