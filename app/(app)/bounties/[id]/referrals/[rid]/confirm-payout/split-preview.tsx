import { t, type Lang } from "@/lib/i18n";
import { formatBonus, formatLocaleForLang } from "@/lib/format";
import {
  INSERENT_BPS,
  CANDIDATE_BPS,
  PLATFORM_NO_REFERRER_BPS,
  PLATFORM_WITH_REFERRER_BPS,
  REFERRER_SINGLE_BPS,
  REFERRER_DOUBLE_BPS,
} from "@/lib/stripe/split-constants";

/**
 * Konzept-konforme Anzeige des Auszahlungs-Splits (40/35/5/20).
 *
 * Erwartet die tatsächliche Referrer-Konstellation für diesen Vorgang:
 *   - referrerOfInserent / referrerOfCandidate: gibt es einen Referrer?
 *
 * Falls die Information (noch) nicht bekannt ist (z. B. vor finaler
 * Zuordnung), kann `referrerState="unknown"` gesetzt werden – dann wird
 * der konservative Fall (kein Referrer ⇒ Plattform 25 %) angezeigt
 * und ein Hinweis auf mögliche Akquiseanteile eingeblendet.
 */
export function SplitPreview({
  lang,
  bonus,
  currency,
  hasReferrerOfInserent = false,
  hasReferrerOfCandidate = false,
}: {
  lang: Lang;
  bonus: number;
  currency: string;
  hasReferrerOfInserent?: boolean;
  hasReferrerOfCandidate?: boolean;
}) {
  const locale = formatLocaleForLang(lang);
  const numReferrers =
    (hasReferrerOfInserent ? 1 : 0) + (hasReferrerOfCandidate ? 1 : 0);

  const inserentBps = INSERENT_BPS;
  const candidateBps = CANDIDATE_BPS;
  const platformBps =
    numReferrers === 0 ? PLATFORM_NO_REFERRER_BPS : PLATFORM_WITH_REFERRER_BPS;

  const refOfInserentBps = hasReferrerOfInserent
    ? numReferrers === 2
      ? REFERRER_DOUBLE_BPS
      : REFERRER_SINGLE_BPS
    : 0;
  const refOfCandidateBps = hasReferrerOfCandidate
    ? numReferrers === 2
      ? REFERRER_DOUBLE_BPS
      : REFERRER_SINGLE_BPS
    : 0;

  const inserentShare = (bonus * inserentBps) / 10_000;
  const candidateShare = (bonus * candidateBps) / 10_000;
  const refOfInserentShare = (bonus * refOfInserentBps) / 10_000;
  const refOfCandidateShare = (bonus * refOfCandidateBps) / 10_000;
  const platformShare = (bonus * platformBps) / 10_000;

  const noteKey =
    numReferrers === 0
      ? "billing_split_note_no_referrer"
      : numReferrers === 1
        ? "billing_split_note_one_referrer"
        : "billing_split_note_two_referrers";

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5">
      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
        {t(lang, "billing_split_title")}
      </h3>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        {t(lang, "billing_split_desc")}
      </p>

      <div className="mt-4 flex flex-col gap-2 border-t border-[var(--color-surface-border)] pt-4 text-sm">
        <div className="flex items-center justify-between font-medium">
          <span className="text-[var(--color-text-primary)]">{t(lang, "billing_split_total")}</span>
          <span className="text-[var(--color-text-primary)]">
            {formatBonus(bonus, currency, locale)}
          </span>
        </div>

        <div className="mt-2 flex flex-col gap-1.5 pl-4 border-l-2 border-[var(--color-surface-border)]">
          <SplitRow
            label={`${t(lang, "billing_split_inserent")} (${formatPct(inserentBps)})`}
            value={formatBonus(inserentShare, currency, locale)}
            tone="primary"
          />
          <SplitRow
            label={`${t(lang, "billing_split_candidate")} (${formatPct(candidateBps)})`}
            value={formatBonus(candidateShare, currency, locale)}
            tone="primary"
          />

          {hasReferrerOfInserent && (
            <SplitRow
              label={`${t(lang, "billing_split_referrer_share_inserent")} (${formatPct(refOfInserentBps)})`}
              value={formatBonus(refOfInserentShare, currency, locale)}
              tone="muted"
            />
          )}
          {hasReferrerOfCandidate && (
            <SplitRow
              label={`${t(lang, "billing_split_referrer_share_candidate")} (${formatPct(refOfCandidateBps)})`}
              value={formatBonus(refOfCandidateShare, currency, locale)}
              tone="muted"
            />
          )}

          <SplitRow
            label={`${t(lang, "billing_split_platform")} (${formatPct(platformBps)})`}
            value={formatBonus(platformShare, currency, locale)}
            tone="faint"
          />
        </div>

        <p className="mt-3 text-xs text-[var(--color-text-faint)]">
          {t(lang, noteKey)}
        </p>
      </div>
    </div>
  );
}

function SplitRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "muted" | "faint";
}) {
  const colorClass =
    tone === "primary"
      ? "text-[var(--color-text-primary)]"
      : tone === "muted"
        ? "text-[var(--color-text-muted)]"
        : "text-[var(--color-text-faint)]";
  return (
    <div className={`flex items-center justify-between ${colorClass}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Formatiert BPS als Prozent. 4000 → "40 %", 250 → "2,5 %". */
function formatPct(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct} %` : `${pct.toString().replace(".", ",")} %`;
}
