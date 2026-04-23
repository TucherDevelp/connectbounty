import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium whitespace-nowrap select-none",
    "transition-colors transition-shadow duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-[var(--color-brand-400)] focus-visible:ring-offset-[var(--color-surface-bg)]",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-brand-400)] text-[#0b1220] hover:bg-[var(--color-brand-300)] shadow-sm",
        secondary:
          "bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-border)] hover:bg-[var(--color-surface-3)]",
        ghost:
          "bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-1)]",
        outline:
          "border border-[var(--color-brand-400)] text-[var(--color-brand-400)] hover:bg-[var(--color-brand-400)]/10",
        destructive:
          "bg-[var(--color-error)] text-white hover:bg-[#ef4444] shadow-sm",
      },
      size: {
        sm: "h-8 px-3 text-sm rounded-[var(--radius-sm)]",
        md: "h-10 px-4 text-sm rounded-[var(--radius-md)]",
        lg: "h-12 px-6 text-base rounded-[var(--radius-md)]",
        icon: "h-10 w-10 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
