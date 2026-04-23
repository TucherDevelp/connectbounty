import { Skeleton } from "@/components/ui/skeleton";

export default function MyReferralsLoading() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36" />
      </header>
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-6">
            <div className="flex justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-5 w-20 shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
