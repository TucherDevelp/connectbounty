/**
 * Konzept-konforme Split-Konstanten.
 *
 * Bewusst OHNE `server-only`-Annotation, damit auch UI-Komponenten
 * (z. B. Bounty-Form-Vorschau, Confirm-Payout-Preview) den verbindlichen
 * Schlüssel anzeigen können, ohne ihn zu duplizieren.
 *
 * Quelle: docs/KONZEPTPLATTFORM-GESCHAEFTSMODELL.md, Abschnitt 6.
 *
 * Schlüssel: 40 % Inserent / 35 % Kandidat / 5 % Referrer / 20 % Plattform.
 *  - Ohne Referrer fließt der 5 %-Akquiseanteil an die Plattform (25 %).
 *  - Bei zwei Referrern wird der 5 %-Block fix auf 2,5 % / 2,5 % aufgeteilt.
 */

/** Inserent: 40 % */
export const INSERENT_BPS = 4000;
/** Kandidat: 35 % */
export const CANDIDATE_BPS = 3500;
/** Plattform-Basisanteil bei mindestens einem Referrer: 20 % */
export const PLATFORM_WITH_REFERRER_BPS = 2000;
/** Plattform-Anteil ohne Referrer: 25 % (entfallender Referrer-Block fließt an Plattform) */
export const PLATFORM_NO_REFERRER_BPS = 2500;
/** Referrer-Anteil insgesamt (genau ein Referrer beteiligt): 5 % */
export const REFERRER_SINGLE_BPS = 500;
/** Referrer-Anteil pro Person bei zwei beteiligten Referrern: 2,5 % */
export const REFERRER_DOUBLE_BPS = 250;
/** Referrer-Block insgesamt (Brutto-Pool für alle Referrer): 5 % */
export const TOTAL_REFERRER_SHARE_BPS = 500;

/**
 * Verbindliche Default-Konfiguration nach Konzept (Plattform-Basisblock 25 %).
 * Der 5 %-Referrer-Anteil wird laufzeitseitig vom Plattform-Block abgezogen.
 *
 * Feldnamen spiegeln die Konzept-Personas:
 *   inserentBps  = Anteil des Inserenten (Bounty-Ersteller, 40 %)
 *   candidateBps = Anteil des Kandidaten (Bewerber, 35 %)
 *   platformBps  = Plattform-Basisblock ohne Referrer (25 %)
 *
 * DB-Spalten in `bounties`: `split_inserent_bps`, `split_candidate_bps`,
 * `split_platform_bps` (umbenannt in Migration 0013).
 */
export const FIXED_SPLIT_CONFIG = {
  inserentBps: INSERENT_BPS,
  candidateBps: CANDIDATE_BPS,
  platformBps: PLATFORM_NO_REFERRER_BPS,
} as const;

export type SplitConfig = {
  /** Inserent-Quote (Bounty-Ersteller). DB-Spalte: `split_inserent_bps`. */
  inserentBps: number;
  /** Kandidaten-Quote (Bewerber). DB-Spalte: `split_candidate_bps`. */
  candidateBps: number;
  /** Plattform-Basisblock (ohne Referrer). DB-Spalte: `split_platform_bps`. */
  platformBps: number;
};
