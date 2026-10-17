import type { Metadata } from "next";
import { ReviewView } from "@/components/day/day-flows";

export const metadata: Metadata = { title: "Review your day" };

export default function Page() {
  return <ReviewView />;
}
