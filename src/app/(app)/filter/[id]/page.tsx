import { localizedTitle } from "@/i18n/server";
import { FilterView } from "@/components/tasks/views";

export const generateMetadata = localizedTitle((t) => t.filter.filter);

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FilterView key={id} id={decodeURIComponent(id)} />;
}
