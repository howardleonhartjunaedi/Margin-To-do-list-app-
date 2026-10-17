import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Magnetic } from "../cursor/magnetic";

export const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium",
    // Press = slight scale-down. Colors change on hover; nothing reflows.
    "transition-[transform,background-color,color,box-shadow,opacity] duration-(--dur-fast) ease-enter",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink shadow-1 hover:bg-accent-hover",
        secondary: "bg-raised text-ink shadow-1 ring-1 ring-line ring-inset hover:bg-surface hover:ring-line-strong",
        ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
        danger: "bg-danger-soft text-danger hover:ring-1 hover:ring-inset hover:ring-danger",
        link: "h-auto px-0 text-accent underline decoration-1 underline-offset-4 hover:decoration-2 active:scale-100",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Gently pulls toward the cursor. Reserve for the screen's one primary action. */
  magnetic?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, magnetic, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const el = (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
  return magnetic ? <Magnetic>{el}</Magnetic> : el;
});
