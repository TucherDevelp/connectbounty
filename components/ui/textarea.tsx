import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 6, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      data-invalid={invalid || undefined}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex w-full rounded-[var(--radius-md)] border bg-[var(--color-surface-1)] px-3 py-2",
        "text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-faint)]",
        "border-[var(--color-surface-border)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)]",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-bg)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[invalid=true]:border-[var(--color-error)] data-[invalid=true]:focus-visible:ring-[var(--color-error)]",
        "resize-y leading-relaxed",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
