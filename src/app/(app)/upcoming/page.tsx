import type { Metadata } from "next";
import { UpcomingView } from "@/components/tasks/views";

export const metadata: Metadata = { title: "Upcoming" };

export default function Page() {
  return <UpcomingView />;
}
