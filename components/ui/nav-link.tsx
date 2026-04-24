"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  className?: string;
}

export function NavLink({ href, children, exact = false, className }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "relative text-sm transition-colors",
        isActive
          ? "text-[var(--color-text-primary)] font-medium after:absolute after:-bottom-0.5 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[var(--color-brand-400)]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
