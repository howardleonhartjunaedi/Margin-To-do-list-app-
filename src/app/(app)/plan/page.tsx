import type { Metadata } from "next";
import { PlanView } from "@/components/day/day-flows";

export const metadata: Metadata = { title: "Plan your day" };

export default function Page() {
  return <PlanView />;
}
