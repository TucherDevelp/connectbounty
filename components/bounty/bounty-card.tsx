import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BountyStatusBadge } from "@/components/bounty/status-badge";
import { formatBonus, formatDate } from "@/lib/format";
import type { BountyListItem } from "@/lib/bounty/queries";

/**
 * Darstellung einer Bounty in der öffentlichen Liste.
 * Der komplette Card-Body verlinkt zur Detailseite – wir verschachteln
 * den Link bewusst nicht in Card-Actions, damit Screenreader ein klares
 * Ziel haben.
 */
export function BountyCard({
  bounty,
  showStatus = false,
}: {
  bounty: BountyListItem;
  showStatus?: boolean;
}) {
  const expires = formatDate(bounty.expires_at);
  const published = formatDate(bounty.published_at);

  return (
    <Card className="transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--color-brand-600)/40]">
      <Link href={`/bounties/${bounty.id}`} className="block focus:outline-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{bounty.title}</CardTitle>
            <CardDescription className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span className="font-medium text-[var(--color-text-primary)]">
                {formatBonus(Number(bounty.bonus_amount), bounty.bonus_currency)}
              </span>
              {bounty.location && <span>· {bounty.location}</span>}
              {bounty.industry && <span>· {bounty.industry}</span>}
              {published && <span>· Veröffentlicht {published}</span>}
              {expires && <span>· Läuft ab {expires}</span>}
            </CardDescription>
          </div>
          {showStatus && <BountyStatusBadge status={bounty.status} />}
        </CardHeader>
        <CardContent>
          <p className="line-clamp-3 text-sm text-[var(--color-text-muted)]">
            {bounty.description}
          </p>
          {bounty.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {bounty.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Link>
    </Card>
  );
}
