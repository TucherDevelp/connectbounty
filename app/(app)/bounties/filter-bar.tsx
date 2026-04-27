import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { BountyFilters } from "@/lib/bounty/queries";

export type BountyFilterBarLabels = {
  search: string;
  searchPlaceholder: string;
  industry: string;
  industryPlaceholder: string;
  location: string;
  locationPlaceholder: string;
  tag: string;
  tagPlaceholder: string;
  minBonus: string;
  minBonusPlaceholder: string;
  reset: string;
  apply: string;
};

/**
 * Server-gerenderte Filter-Leiste.
 * Nutzt ein klassisches GET-Form → kein Client-State nötig.
 * Reset = Link auf /bounties.
 */
export function BountyFilterBar({
  filters,
  labels,
}: {
  filters: BountyFilters;
  labels: BountyFilterBarLabels;
}) {
  return (
    <form
      method="GET"
      action="/bounties"
      className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
        {labels.search}
        <Input name="q" defaultValue={filters.q ?? ""} placeholder={labels.searchPlaceholder} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
        {labels.industry}
        <Input name="industry" defaultValue={filters.industry ?? ""} placeholder={labels.industryPlaceholder} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
        {labels.location}
        <Input name="location" defaultValue={filters.location ?? ""} placeholder={labels.locationPlaceholder} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
        {labels.tag}
        <Input name="tag" defaultValue={filters.tag ?? ""} placeholder={labels.tagPlaceholder} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
        {labels.minBonus}
        <Input
          name="minBonus"
          inputMode="decimal"
          defaultValue={filters.minBonus !== undefined ? String(filters.minBonus) : ""}
          placeholder={labels.minBonusPlaceholder}
        />
      </label>
      <div className="col-span-full flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/bounties"
          className="text-sm text-[var(--color-text-muted)] underline-offset-4 hover:text-[var(--color-text-primary)] hover:underline"
        >
          {labels.reset}
        </Link>
        <Button type="submit" size="sm" variant="primary">
          {labels.apply}
        </Button>
      </div>
    </form>
  );
}
