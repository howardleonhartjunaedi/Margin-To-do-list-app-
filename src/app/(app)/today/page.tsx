import type { Metadata } from "next";
import { TodayView } from "@/components/tasks/views";

export const metadata: Metadata = { title: "Today" };

export default function Page() {
  return <TodayView />;
}
