import type { Metadata } from "next";
import { FilterView } from "@/components/tasks/views";

export const metadata: Metadata = { title: "Filter" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FilterView key={id} id={decodeURIComponent(id)} />;
}
