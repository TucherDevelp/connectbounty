import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { BountyFilters } from "@/lib/bounty/queries";

/**
 * Server-gerenderte Filter-Leiste.
 * Nutzt ein klassisches GET-Form → kein Client-State nötig.
 * Reset = Link auf /bounties.
 */
export function BountyFilterBar({ filters }: { filters: BountyFilters }) {
  return (
    <form
      method="GET"
      action="/bounties"
      className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
        Suche
        <Input name="q" defaultValue={filters.q ?? ""} placeholder="Titel oder Beschreibung" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
        Branche
        <Input name="industry" defaultValue={filters.industry ?? ""} placeholder="z. B. Software" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
        Ort
        <Input name="location" defaultValue={filters.location ?? ""} placeholder="z. B. Berlin" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
        Tag
        <Input name="tag" defaultValue={filters.tag ?? ""} placeholder="z. B. react" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
        Mindestprämie
        <Input
          name="minBonus"
          inputMode="decimal"
          defaultValue={filters.minBonus !== undefined ? String(filters.minBonus) : ""}
          placeholder="z. B. 1000"
        />
      </label>
      <div className="col-span-full flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/bounties"
          className="text-sm text-[var(--color-text-muted)] underline-offset-4 hover:text-[var(--color-text-primary)] hover:underline"
        >
          Filter zurücksetzen
        </Link>
        <Button type="submit" size="sm" variant="primary">
          Anwenden
        </Button>
      </div>
    </form>
  );
}
