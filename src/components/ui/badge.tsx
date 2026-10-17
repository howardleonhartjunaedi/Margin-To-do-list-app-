import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-sunken text-ink-2",
        accent: "bg-accent-soft text-ink",
        success: "bg-success-soft text-ink",
        warning: "bg-warning-soft text-ink",
        danger: "bg-danger-soft text-ink",
        outline: "text-ink-2 ring-1 ring-line-strong ring-inset",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  tone,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** Keyboard key. Mono, small, quiet. */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-raised px-1 font-mono text-2xs text-ink-2",
        "shadow-[inset_0_-1px_0_var(--c-line-strong)] ring-1 ring-line ring-inset",
        className,
      )}
      {...props}
    />
  );
}

/** Small leading dot for project colors and status. Always paired with text. */
export function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full bg-ink-3", className)} />;
}
