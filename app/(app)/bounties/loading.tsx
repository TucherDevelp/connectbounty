import { CardListSkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function BountiesLoading() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8 space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </header>
      <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="col-span-1 h-10" />
          ))}
        </div>
      </div>
      <CardListSkeleton count={6} />
    </section>
  );
}
