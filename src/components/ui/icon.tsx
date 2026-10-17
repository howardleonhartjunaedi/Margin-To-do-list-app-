import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/cn";

const SIZES = { xs: 14, sm: 16, md: 20, lg: 24 } as const;

/** Stroke width for every icon in the product. Absolute, so it doesn't thin out at 24px. */
export const ICON_STROKE = 1.5;

interface IconProps extends Omit<LucideProps, "size" | "strokeWidth"> {
  icon: LucideIcon;
  size?: keyof typeof SIZES;
  /** Pass a label only when the icon carries meaning on its own (no visible text next to it). */
  label?: string;
}

/** The only way icons enter the UI: one set (Lucide), one stroke, four sizes. */
export function Icon({ icon: Glyph, size = "sm", label, className, ...rest }: IconProps) {
  return (
    <Glyph
      size={SIZES[size]}
      strokeWidth={ICON_STROKE}
      absoluteStrokeWidth
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn("shrink-0", className)}
      {...rest}
    />
  );
}
