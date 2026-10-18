import type { ProjectColor } from "./types";

/** Project colors come from the token palette only. Always shown with the project's name. */
export const PROJECT_COLORS: { value: ProjectColor; dot: string }[] = [
  { value: "ink", dot: "bg-ink-3" },
  { value: "accent", dot: "bg-accent" },
  { value: "p1", dot: "bg-p1" },
  { value: "p2", dot: "bg-p2" },
  { value: "p3", dot: "bg-p3" },
  { value: "success", dot: "bg-success" },
];

export const projectDot = (c: string) => PROJECT_COLORS.find((p) => p.value === c)?.dot ?? "bg-ink-3";
