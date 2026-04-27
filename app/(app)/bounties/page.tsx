import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t, type TranslationKey } from "@/lib/i18n";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-error";
import { BountyCard } from "@/components/bounty/bounty-card";
import { BountyFilterBar } from "./filter-bar";
import {
  bountyFiltersSchema,
  expireStaleBounciesLazy,
  listOpenBounties,
  PAGE_SIZE,
  type BountyFilters,
} from "@/lib/bounty/queries";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({
    title: "meta_marketplace_title",
    description: "meta_marketplace_desc",
  });
}

// Dynamic - die Liste hängt von Query-Parametern & Session ab.
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function buildPageHref(current: BountyFilters, page: number): string {
  const p = new URLSearchParams();
  if (current.q) p.set("q", current.q);
  if (current.industry) p.set("industry", current.industry);
  if (current.location) p.set("location", current.location);
  if (current.tag) p.set("tag", current.tag);
  if (current.minBonus !== undefined) p.set("minBonus", String(current.minBonus));
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/bounties?${qs}` : "/bounties";
}

export default async function PublicBountiesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  const parsed = bountyFiltersSchema.safeParse({
    q: pickFirst(sp.q),
    industry: pickFirst(sp.industry),
    location: pickFirst(sp.location),
    tag: pickFirst(sp.tag),
    minBonus: pickFirst(sp.minBonus),
    page: pickFirst(sp.page),
  });

  // Bei kaputten Filtern: ignorieren, defaults verwenden - Marktplatz darf
  // nicht wegen eines seltsamen Query-Params leer bleiben.
  const filters: BountyFilters = parsed.success
    ? parsed.data
    : bountyFiltersSchema.parse({});

  // Lazy-expire vor dem Listing - markiert abgelaufene Bounties atomar.
  await expireStaleBounciesLazy();

  let list:
    | Awaited<ReturnType<typeof listOpenBounties>>
    | { items: []; total: 0; page: number; pageSize: number; hasMore: false; failed: true };
  try {
    list = await listOpenBounties(filters);
  } catch {
    list = {
      items: [],
      total: 0,
      page: filters.page ?? 1,
      pageSize: PAGE_SIZE,
      hasMore: false,
      failed: true,
    };
  }

  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const currentPage = list.page;

  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const tr = (key: TranslationKey) => t(lang, key);
  const filterLabels = {
    search: tr("bounty_filter_search"),
    searchPlaceholder: tr("bounty_filter_search_ph"),
    industry: tr("bounty_filter_industry"),
    industryPlaceholder: tr("bounty_filter_industry_ph"),
    location: tr("bounty_filter_location"),
    locationPlaceholder: tr("bounty_filter_location_ph"),
    tag: tr("bounty_filter_tag"),
    tagPlaceholder: tr("bounty_filter_tag_ph"),
    minBonus: tr("bounty_filter_min_bonus"),
    minBonusPlaceholder: tr("bounty_filter_min_bonus_ph"),
    reset: tr("bounty_filter_reset"),
    apply: tr("bounty_filter_apply"),
  };

  const resultsLine =
    list.total === 1
      ? tr("marketplace_count_single")
      : tr("marketplace_count_multi").replace("{n}", String(list.total));

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{tr("marketplace_title")}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{tr("marketplace_subtitle")}</p>
        </div>
      </header>

      <div className="mb-6">
        <BountyFilterBar filters={filters} labels={filterLabels} />
      </div>

      {"failed" in list && list.failed && (
        <div className="mb-6">
          <FormAlert>{tr("marketplace_error_load")}</FormAlert>
        </div>
      )}

      {!parsed.success && (
        <div className="mb-6">
          <FormAlert variant="warning">{tr("marketplace_filter_invalid")}</FormAlert>
        </div>
      )}

      {list.items.length > 0 ? (
        <>
          <p className="mb-4 text-xs text-[var(--color-text-muted)]">{resultsLine}</p>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.items.map((b) => (
              <li key={b.id} className="flex">
                <BountyCard bounty={b} />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav
              aria-label={tr("a11y_pagination")}
              className="mt-8 flex items-center justify-center gap-2 text-sm"
            >
              {currentPage > 1 && (
                <Link
                  href={buildPageHref(filters, currentPage - 1)}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] px-3 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <ArrowLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                  {tr("pagination_prev")}
                </Link>
              )}
              <span className="px-3 py-1.5 text-[var(--color-text-muted)]">
                {tr("pagination_page")
                  .replace("{current}", String(currentPage))
                  .replace("{total}", String(totalPages))}
              </span>
              {list.hasMore && (
                <Link
                  href={buildPageHref(filters, currentPage + 1)}
                  className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] px-3 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <span className="inline-flex items-center gap-1">
                    {tr("pagination_next")}
                    <ArrowRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                  </span>
                </Link>
              )}
            </nav>
          )}
        </>
      ) : (
        !("failed" in list && list.failed) && (
          <Card>
            <CardHeader>
              <CardTitle>{tr("marketplace_empty_title")}</CardTitle>
              <CardDescription>{tr("marketplace_empty_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href="/bounties" className="underline underline-offset-4">
                  {tr("marketplace_reset_filters")}
                </Link>
                <Link
                  href="/bounties/new"
                  className="text-[var(--color-brand)] underline underline-offset-4"
                >
                  {tr("marketplace_create_own")}
                </Link>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </section>
  );
}
