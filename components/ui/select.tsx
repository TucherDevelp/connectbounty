import * as React from "react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        data-invalid={invalid || undefined}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex min-h-11 w-full appearance-none rounded-[var(--radius-md)] border bg-surface px-3 py-2 pr-8",
          "text-base text-foreground",
          "border-border/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[invalid=true]:border-destructive data-[invalid=true]:focus-visible:ring-destructive",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground opacity-50"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  ),
);
Select.displayName = "Select";
