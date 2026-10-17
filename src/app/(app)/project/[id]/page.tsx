import type { Metadata } from "next";
import { ProjectView } from "@/components/tasks/views";

export const metadata: Metadata = { title: "Project" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectView key={id} id={decodeURIComponent(id)} />;
}
