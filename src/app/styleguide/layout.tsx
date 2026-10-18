import { UiRoot } from "@/components/providers/ui-root";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <UiRoot>{children}</UiRoot>;
}
