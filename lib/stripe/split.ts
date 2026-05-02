import "server-only";

import {
  INSERENT_BPS,
  CANDIDATE_BPS,
  PLATFORM_NO_REFERRER_BPS,
  REFERRER_SINGLE_BPS,
  REFERRER_DOUBLE_BPS,
  TOTAL_REFERRER_SHARE_BPS,
  FIXED_SPLIT_CONFIG as FIXED_SPLIT_CONFIG_RAW,
  type SplitConfig,
} from "./split-constants";

/**
 * Split-Berechnung für die Bonus-Auszahlung.
 *
 * Konzept (siehe docs/KONZEPTPLATTFORM-GESCHAEFTSMODELL.md, Abschnitt 6):
 *   Fester Schlüssel: 40 % Inserent / 35 % Kandidat / 5 % Referrer / 20 % Plattform.
 *   Sind keine Referrer beteiligt, geht der entfallende 5 %-Block an die Plattform
 *   (Plattform dann 25 %). Bei zwei Referrern wird der 5 %-Block fix auf 2,5 % / 2,5 %
 *   aufgeteilt.
 *
 * Geldfluss:
 *   Firma → Plattform-Konto (Invoice)
 *   → Inserent          (40 %)
 *   → Kandidat          (35 %)
 *   → Referrer-Inserent (5 % bzw. 2,5 % bei zwei Referrern; sonst 0)
 *   → Referrer-Kandidat (5 % bzw. 2,5 % bei zwei Referrern; sonst 0)
 *   → Plattform behält Rest (20 % mit Referrer, 25 % ohne)
 *
 * Alle Anteile in Basis-Punkten (BPS): 10 000 = 100 %.
 * Rundung: Math.floor je Empfänger; verbleibende Cents gehen an die Plattform.
 *
 * Invariante: inserentCents + candidateCents + referrerOfInserentCents
 *             + referrerOfCandidateCents + platformCents === totalCents
 */

// Re-Exports der Konzept-Konstanten (Backward-Compat für bestehende Importe).
export {
  INSERENT_BPS,
  CANDIDATE_BPS,
  PLATFORM_WITH_REFERRER_BPS,
  PLATFORM_NO_REFERRER_BPS,
  REFERRER_SINGLE_BPS,
  REFERRER_DOUBLE_BPS,
  TOTAL_REFERRER_SHARE_BPS,
} from "./split-constants";
export type { SplitConfig } from "./split-constants";

/**
 * @deprecated Aliasname aus Phase A. Verwende stattdessen `REFERRER_DOUBLE_BPS`.
 */
export const REFERRER_SHARE_BPS = REFERRER_DOUBLE_BPS;

export type SplitInput = {
  totalCents: number;
  splits: SplitConfig;
  /** true wenn der Inserent über einen Referral-Link onboardet wurde */
  hasReferrerOfA: boolean;
  /** true wenn der Kandidat über einen Referral-Link onboardet wurde */
  hasReferrerOfB: boolean;
};

export type SplitResult = {
  /** Inserent-Anteil in Cent (40 %) - Legacy-Alias `personACents` */
  personACents: number;
  /** Kandidat-Anteil in Cent (35 %) - Legacy-Alias `personBCents` */
  personBCents: number;
  /** Referrer des Inserenten (0 / 2,5 % / 5 %) */
  refOfACents: number;
  /** Referrer des Kandidaten (0 / 2,5 % / 5 %) */
  refOfBCents: number;
  /** Plattform-Anteil in Cent (20 % bzw. 25 % ohne Referrer + Rundungsreste) */
  platformCents: number;
  /** Für Logging/Audit: Summen-Check */
  totalCents: number;
};

/**
 * Konzept-konforme Sicht auf das Ergebnis (sprechende Felder).
 * Wird von `computeFixedSplit` zurückgegeben und ist die bevorzugte API
 * für neuen Code. `SplitResult` bleibt für bestehende Aufrufer erhalten.
 */
export type FixedSplitResult = {
  inserentCents: number;
  candidateCents: number;
  referrerOfInserentCents: number;
  referrerOfCandidateCents: number;
  platformCents: number;
  totalCents: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Verbindliche Default-Konfiguration (Konzept)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verbindlicher Split nach Konzept: 40 % Inserent / 35 % Kandidat / 25 % Plattform-Basisblock.
 * Der Referrer-Anteil wird laufzeitseitig vom Plattform-Block abgezogen
 * (5 % einfach, 2×2,5 % bei zwei Referrern). Ohne Referrer behält die Plattform 25 %.
 */
export const FIXED_SPLIT_CONFIG: SplitConfig = FIXED_SPLIT_CONFIG_RAW;

/**
 * @deprecated Aliasname für `FIXED_SPLIT_CONFIG`. Konzept-Split ist verbindlich.
 */
export const DEFAULT_SPLIT_CONFIG: SplitConfig = FIXED_SPLIT_CONFIG_RAW;

// ─────────────────────────────────────────────────────────────────────────────
// Hauptfunktion (generisch, mit konfigurierbarem SplitConfig)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Berechnet den Split aller Empfänger für einen gegebenen Bonus.
 * Wirft einen Fehler, wenn die Konfiguration ungültig ist oder die
 * Summe der BPS nicht 10 000 ergibt.
 */
export function computeSplit(input: SplitInput): SplitResult {
  const { totalCents, splits, hasReferrerOfA, hasReferrerOfB } = input;

  if (totalCents <= 0) {
    throw new Error(`computeSplit: totalCents muss > 0 sein (war ${totalCents})`);
  }
  if (splits.inserentBps + splits.candidateBps + splits.platformBps !== 10_000) {
    throw new Error(
      `computeSplit: BPS-Summe muss 10 000 ergeben ` +
        `(war ${splits.inserentBps + splits.candidateBps + splits.platformBps})`,
    );
  }
  if (splits.platformBps < TOTAL_REFERRER_SHARE_BPS) {
    throw new Error(
      `computeSplit: platformBps muss mindestens ${TOTAL_REFERRER_SHARE_BPS} sein (war ${splits.platformBps})`,
    );
  }

  const numReferrers = (hasReferrerOfA ? 1 : 0) + (hasReferrerOfB ? 1 : 0);
  let refOfACents = 0;
  let refOfBCents = 0;

  if (numReferrers === 1) {
    const share = floorBps(totalCents, REFERRER_SINGLE_BPS);
    if (hasReferrerOfA) refOfACents = share;
    if (hasReferrerOfB) refOfBCents = share;
  } else if (numReferrers === 2) {
    const share = floorBps(totalCents, REFERRER_DOUBLE_BPS);
    refOfACents = share;
    refOfBCents = share;
  }

  const personACents = floorBps(totalCents, splits.inserentBps);
  const personBCents = floorBps(totalCents, splits.candidateBps);

  const platformCents =
    totalCents - personACents - personBCents - refOfACents - refOfBCents;

  if (platformCents < 0) {
    throw new Error(
      `computeSplit: Plattform-Anteil wäre negativ (${platformCents} Cent). ` +
        `Prüfe BPS-Konfiguration und Referrer-Anzahl.`,
    );
  }

  return {
    personACents,
    personBCents,
    refOfACents,
    refOfBCents,
    platformCents,
    totalCents,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Konzept-konformer Wrapper (verbindlich, nicht konfigurierbar)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Berechnet den Split nach dem im Konzept festgelegten Schlüssel
 * (40 % / 35 % / 5 % / 20 % bzw. 25 % ohne Referrer).
 *
 * Diese Funktion ist die bevorzugte API für neuen Code und stellt sicher,
 * dass der Split nicht versehentlich überschrieben werden kann.
 */
export function computeFixedSplit(opts: {
  totalCents: number;
  hasReferrerOfInserent: boolean;
  hasReferrerOfCandidate: boolean;
}): FixedSplitResult {
  const r = computeSplit({
    totalCents: opts.totalCents,
    splits: FIXED_SPLIT_CONFIG,
    hasReferrerOfA: opts.hasReferrerOfInserent,
    hasReferrerOfB: opts.hasReferrerOfCandidate,
  });
  return {
    inserentCents: r.personACents,
    candidateCents: r.personBCents,
    referrerOfInserentCents: r.refOfACents,
    referrerOfCandidateCents: r.refOfBCents,
    platformCents: r.platformCents,
    totalCents: r.totalCents,
  };
}

/**
 * Prüft, ob ein in der DB gespeicherter Split-Konfigurationssatz dem
 * verbindlichen Konzept-Schlüssel entspricht. Wirft, wenn abweichend.
 *
 * Genutzt vom Payout-Orchestrator als Defense-in-Depth: Selbst wenn
 * `bounties.split_*_bps` über eine andere Codeschicht geändert würde,
 * verweigert der Payout die Auszahlung mit abweichendem Split.
 */
export function assertFixedSplit(splits: SplitConfig): void {
  if (
    splits.inserentBps !== INSERENT_BPS ||
    splits.candidateBps !== CANDIDATE_BPS ||
    splits.platformBps !== PLATFORM_NO_REFERRER_BPS
  ) {
    throw new Error(
      `assertFixedSplit: Split weicht vom verbindlichen Konzept-Schlüssel ab ` +
        `(Inserent=${INSERENT_BPS}, Kandidat=${CANDIDATE_BPS}, Plattform=${PLATFORM_NO_REFERRER_BPS}, ` +
        `aber war ${splits.inserentBps}/${splits.candidateBps}/${splits.platformBps}).`,
    );
  }
}

/** Berechnet BPS-Anteil und rundet auf ganze Cent ab. */
function floorBps(cents: number, bps: number): number {
  return Math.floor((cents * bps) / 10_000);
}
