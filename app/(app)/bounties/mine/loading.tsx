import { Skeleton } from "@/components/ui/skeleton";

export default function MyBountiesLoading() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </header>
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-6">
            <div className="flex justify-between gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3.5 w-1/3" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0" />
            </div>
            <div className="mt-4 space-y-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
