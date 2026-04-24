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
        "flex w-full rounded-[var(--radius-md)] border border-border/60 bg-surface px-3 py-2",
        "text-base text-foreground placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[invalid=true]:border-destructive data-[invalid=true]:focus-visible:ring-destructive",
        "resize-y leading-relaxed",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
