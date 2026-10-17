import { redirect } from "next/navigation";

// Phase 0: the landing page arrives in Phase 6. Until then, the style guide is the front door.
export default function Home() {
  redirect("/styleguide");
}
