import type { Metadata } from "next";
import { InboxView } from "@/components/tasks/views";

export const metadata: Metadata = { title: "Inbox" };

export default function Page() {
  return <InboxView />;
}
