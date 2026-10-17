import type { ProjectColor } from "./types";

/** Project colors come from the token palette only. Always shown with the project's name. */
export const PROJECT_COLORS: { value: ProjectColor; label: string; dot: string }[] = [
  { value: "ink", label: "Graphite", dot: "bg-ink-3" },
  { value: "accent", label: "Fern", dot: "bg-accent" },
  { value: "p1", label: "Crimson", dot: "bg-p1" },
  { value: "p2", label: "Ochre", dot: "bg-p2" },
  { value: "p3", label: "Slate blue", dot: "bg-p3" },
  { value: "success", label: "Teal", dot: "bg-success" },
];

export const projectDot = (c: string) => PROJECT_COLORS.find((p) => p.value === c)?.dot ?? "bg-ink-3";
