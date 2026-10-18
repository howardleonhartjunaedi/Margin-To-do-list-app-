import { localizedTitle } from "@/i18n/server";
import { ProjectView } from "@/components/tasks/views";

export const generateMetadata = localizedTitle((t) => t.palette.project);

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectView key={id} id={decodeURIComponent(id)} />;
}
