import "server-only";

/**
 * Split-Berechnung für die Bonus-Auszahlung.
 *
 * Geldfluss:
 *   Firma → Plattform-Konto (Invoice)
 *   → Inserent A (40 % Default)
 *   → Kandidat  B (40 % Default)
 *   → Referrer von A (2,5 % aus Plattform-Anteil, falls vorhanden)
 *   → Referrer von B (2,5 % aus Plattform-Anteil, falls vorhanden)
 *   → Plattform behält Rest (≥ 15 %)
 *
 * Alle Anteile in Basis-Punkten (BPS): 10 000 = 100 %.
 * Rundung: Math.floor je Empfänger, verbleibende Cents gehen an Plattform.
 *
 * Invariante: personACents + personBCents + refOfACents + refOfBCents
 *             + platformCents === totalCents (immer, keine Cent geht verloren)
 */

export const REFERRER_SHARE_BPS = 250; // 2,5 %

export type SplitConfig = {
  /** Anteil Inserent A in BPS (default 4000 = 40 %) */
  referrerBps: number;
  /** Anteil Kandidat B in BPS (default 4000 = 40 %) */
  candidateBps: number;
  /** Plattform-Anteil in BPS (default 2000 = 20 %) - muss ≥ 500 sein */
  platformBps: number;
};

export type SplitInput = {
  totalCents: number;
  splits: SplitConfig;
  /** true wenn Inserent A über einen Referral-Link ongeboardet wurde */
  hasReferrerOfA: boolean;
  /** true wenn Kandidat B über einen Referral-Link ongeboardet wurde */
  hasReferrerOfB: boolean;
};

export type SplitResult = {
  personACents: number;
  personBCents: number;
  refOfACents: number;
  refOfBCents: number;
  platformCents: number;
  /** Für Logging/Audit: Summen-Check */
  totalCents: number;
};

/**
 * Berechnet den Split aller Empfänger für einen gegebenen Bonus.
 * Wirft einen Fehler wenn die Konfiguration ungültig ist oder die
 * Summe der BPS nicht 10 000 ergibt.
 */
export function computeSplit(input: SplitInput): SplitResult {
  const { totalCents, splits, hasReferrerOfA, hasReferrerOfB } = input;

  if (totalCents <= 0) {
    throw new Error(`computeSplit: totalCents muss > 0 sein (war ${totalCents})`);
  }
  if (splits.referrerBps + splits.candidateBps + splits.platformBps !== 10_000) {
    throw new Error(
      `computeSplit: BPS-Summe muss 10 000 ergeben ` +
        `(war ${splits.referrerBps + splits.candidateBps + splits.platformBps})`,
    );
  }
  if (splits.platformBps < 500) {
    throw new Error(
      `computeSplit: platformBps muss mindestens 500 sein (war ${splits.platformBps})`,
    );
  }

  const refOfACents = hasReferrerOfA ? floorBps(totalCents, REFERRER_SHARE_BPS) : 0;
  const refOfBCents = hasReferrerOfB ? floorBps(totalCents, REFERRER_SHARE_BPS) : 0;

  const personACents = floorBps(totalCents, splits.referrerBps);
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

/** Berechnet BPS-Anteil und rundet auf ganze Cent ab. */
function floorBps(cents: number, bps: number): number {
  return Math.floor((cents * bps) / 10_000);
}

/** Default-Split (40/40/20) für neue Bounties. */
export const DEFAULT_SPLIT_CONFIG: SplitConfig = {
  referrerBps: 4000,
  candidateBps: 4000,
  platformBps: 2000,
};
