import { describe, it, expect } from "vitest";
import {
  computeSplit,
  computeFixedSplit,
  assertFixedSplit,
  DEFAULT_SPLIT_CONFIG,
  FIXED_SPLIT_CONFIG,
  INSERENT_BPS,
  CANDIDATE_BPS,
  PLATFORM_NO_REFERRER_BPS,
  PLATFORM_WITH_REFERRER_BPS,
  REFERRER_SINGLE_BPS,
  REFERRER_DOUBLE_BPS,
  REFERRER_SHARE_BPS,
  type SplitInput,
} from "./split";

const cfg = DEFAULT_SPLIT_CONFIG; // 40/35/25 (Plattform-Basis ohne Referrer)

function input(overrides: Partial<SplitInput> = {}): SplitInput {
  return {
    totalCents: 10_000,
    splits: cfg,
    hasReferrerOfA: false,
    hasReferrerOfB: false,
    ...overrides,
  };
}

describe("computeSplit - kein Referrer", () => {
  it("teilt 10 000 Cent korrekt auf (40/35/25)", () => {
    const r = computeSplit(input());
    expect(r.personACents).toBe(4000);
    expect(r.personBCents).toBe(3500);
    expect(r.refOfACents).toBe(0);
    expect(r.refOfBCents).toBe(0);
    expect(r.platformCents).toBe(2500);
    expect(r.totalCents).toBe(10_000);
  });

  it("Summe ergibt immer totalCents", () => {
    const r = computeSplit(input());
    const sum = r.personACents + r.personBCents + r.refOfACents + r.refOfBCents + r.platformCents;
    expect(sum).toBe(r.totalCents);
  });
});

describe("computeSplit - Referrer von A", () => {
  it("zieht 5 % für Referrer-A vom Plattform-Anteil ab", () => {
    const r = computeSplit(input({ hasReferrerOfA: true }));
    expect(r.refOfACents).toBe(Math.floor((10_000 * 500) / 10_000)); // 500
    expect(r.personACents).toBe(4000);
    expect(r.personBCents).toBe(3500);
    expect(r.platformCents).toBe(2500 - 500); // 2000
    const sum = r.personACents + r.personBCents + r.refOfACents + r.refOfBCents + r.platformCents;
    expect(sum).toBe(10_000);
  });
});

describe("computeSplit - beide Referrer", () => {
  it("zieht 2×2,5 % ab, Plattform behält 20 %", () => {
    const r = computeSplit(input({ hasReferrerOfA: true, hasReferrerOfB: true }));
    expect(r.refOfACents).toBe(250);
    expect(r.refOfBCents).toBe(250);
    expect(r.platformCents).toBe(2000);
    const sum = r.personACents + r.personBCents + r.refOfACents + r.refOfBCents + r.platformCents;
    expect(sum).toBe(10_000);
  });
});

describe("computeSplit - Rundungsrestverbleib bei Plattform", () => {
  it("verliert keinen Cent bei 333-Cent-Basis", () => {
    // 333 Cent: 40 % = 133,2 → floor = 133; 35% = 116.55 -> floor = 116; 2.5% = 8.325 -> floor = 8
    const r = computeSplit(input({ totalCents: 333, hasReferrerOfA: true, hasReferrerOfB: true }));
    const sum = r.personACents + r.personBCents + r.refOfACents + r.refOfBCents + r.platformCents;
    expect(sum).toBe(333);
  });

  it("verliert keinen Cent bei 1-Cent-Basis", () => {
    const r = computeSplit(input({ totalCents: 1 }));
    const sum = r.personACents + r.personBCents + r.refOfACents + r.refOfBCents + r.platformCents;
    expect(sum).toBe(1);
    // Bei 1 Cent kann kein Referrer-Share entstehen (floor ist 0)
    expect(r.personACents).toBe(0);
    expect(r.platformCents).toBe(1);
  });
});

describe("computeSplit - Fehlerfälle", () => {
  it("wirft bei totalCents = 0", () => {
    expect(() => computeSplit(input({ totalCents: 0 }))).toThrow("totalCents muss > 0");
  });

  it("wirft bei negativem totalCents", () => {
    expect(() => computeSplit(input({ totalCents: -1 }))).toThrow("totalCents muss > 0");
  });

  it("wirft wenn BPS-Summe ≠ 10 000", () => {
    expect(() =>
      computeSplit(input({ splits: { inserentBps: 4000, candidateBps: 3500, platformBps: 2499 } })),
    ).toThrow("BPS-Summe");
  });

  it("wirft wenn platformBps < 500", () => {
    expect(() =>
      computeSplit(input({ splits: { inserentBps: 5000, candidateBps: 4700, platformBps: 300 } })),
    ).toThrow("platformBps muss mindestens 500");
  });
});

describe("computeSplit - benutzerdefinierter Split 50/30/20", () => {
  const custom = { inserentBps: 5000, candidateBps: 3000, platformBps: 2000 };

  it("teilt 10 000 korrekt auf", () => {
    const r = computeSplit(input({ splits: custom }));
    expect(r.personACents).toBe(5000);
    expect(r.personBCents).toBe(3000);
    expect(r.platformCents).toBe(2000);
  });

  it("Summe stimmt auch mit beiden Referrern", () => {
    const r = computeSplit(input({ splits: custom, hasReferrerOfA: true, hasReferrerOfB: true }));
    const sum = r.personACents + r.personBCents + r.refOfACents + r.refOfBCents + r.platformCents;
    expect(sum).toBe(10_000);
  });
});

// ─── Konzept-Konstanten ─────────────────────────────────────────────────────

describe("Konzept-Konstanten (40/35/5/20 fix)", () => {
  it("INSERENT_BPS = 4000 (40 %)", () => expect(INSERENT_BPS).toBe(4000));
  it("CANDIDATE_BPS = 3500 (35 %)", () => expect(CANDIDATE_BPS).toBe(3500));
  it("PLATFORM_WITH_REFERRER_BPS = 2000 (20 %)", () => expect(PLATFORM_WITH_REFERRER_BPS).toBe(2000));
  it("PLATFORM_NO_REFERRER_BPS = 2500 (25 %)", () => expect(PLATFORM_NO_REFERRER_BPS).toBe(2500));
  it("REFERRER_SINGLE_BPS = 500 (5 %)", () => expect(REFERRER_SINGLE_BPS).toBe(500));
  it("REFERRER_DOUBLE_BPS = 250 (2,5 %)", () => expect(REFERRER_DOUBLE_BPS).toBe(250));
  it("REFERRER_SHARE_BPS bleibt rückwärtskompatibel = 250", () => expect(REFERRER_SHARE_BPS).toBe(250));

  it("FIXED_SPLIT_CONFIG entspricht 40/35/25 Basis (Referrer-Block via Laufzeit-Abzug)", () => {
    expect(FIXED_SPLIT_CONFIG).toEqual({
      inserentBps: 4000,
      candidateBps: 3500,
      platformBps: 2500,
    });
  });

  it("BPS-Summe der Konzept-Bestandteile ergibt immer 10 000 (mit + ohne Referrer)", () => {
    expect(INSERENT_BPS + CANDIDATE_BPS + REFERRER_SINGLE_BPS + PLATFORM_WITH_REFERRER_BPS).toBe(10_000);
    expect(INSERENT_BPS + CANDIDATE_BPS + REFERRER_DOUBLE_BPS + REFERRER_DOUBLE_BPS + PLATFORM_WITH_REFERRER_BPS).toBe(10_000);
    expect(INSERENT_BPS + CANDIDATE_BPS + PLATFORM_NO_REFERRER_BPS).toBe(10_000);
  });
});

// ─── computeFixedSplit (verbindlicher Konzept-Schlüssel) ────────────────────

describe("computeFixedSplit - kein Referrer", () => {
  it("teilt 10 000 Cent in 40/35/25 (Plattform behält Referrer-Block)", () => {
    const r = computeFixedSplit({
      totalCents: 10_000,
      hasReferrerOfInserent: false,
      hasReferrerOfCandidate: false,
    });
    expect(r.inserentCents).toBe(4000);
    expect(r.candidateCents).toBe(3500);
    expect(r.referrerOfInserentCents).toBe(0);
    expect(r.referrerOfCandidateCents).toBe(0);
    expect(r.platformCents).toBe(2500);
    expect(r.totalCents).toBe(10_000);
  });
});

describe("computeFixedSplit - genau ein Referrer", () => {
  it("Referrer des Inserenten erhält 5 %, Plattform behält 20 %", () => {
    const r = computeFixedSplit({
      totalCents: 10_000,
      hasReferrerOfInserent: true,
      hasReferrerOfCandidate: false,
    });
    expect(r.inserentCents).toBe(4000);
    expect(r.candidateCents).toBe(3500);
    expect(r.referrerOfInserentCents).toBe(500);
    expect(r.referrerOfCandidateCents).toBe(0);
    expect(r.platformCents).toBe(2000);
  });

  it("Referrer des Kandidaten erhält 5 %, Plattform behält 20 %", () => {
    const r = computeFixedSplit({
      totalCents: 10_000,
      hasReferrerOfInserent: false,
      hasReferrerOfCandidate: true,
    });
    expect(r.inserentCents).toBe(4000);
    expect(r.candidateCents).toBe(3500);
    expect(r.referrerOfInserentCents).toBe(0);
    expect(r.referrerOfCandidateCents).toBe(500);
    expect(r.platformCents).toBe(2000);
  });
});

describe("computeFixedSplit - zwei Referrer (2,5 / 2,5)", () => {
  it("zerlegt 5 %-Block fix in zwei Hälften", () => {
    const r = computeFixedSplit({
      totalCents: 10_000,
      hasReferrerOfInserent: true,
      hasReferrerOfCandidate: true,
    });
    expect(r.referrerOfInserentCents).toBe(250);
    expect(r.referrerOfCandidateCents).toBe(250);
    expect(r.inserentCents).toBe(4000);
    expect(r.candidateCents).toBe(3500);
    expect(r.platformCents).toBe(2000);
  });
});

describe("computeFixedSplit - Invariante: Cent-erhaltend bei beliebigen Beträgen", () => {
  for (const total of [1, 7, 100, 333, 999, 12_345, 1_000_000]) {
    for (const [a, b] of [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ] as const) {
      it(`Summe stimmt für total=${total}, refA=${a}, refB=${b}`, () => {
        const r = computeFixedSplit({
          totalCents: total,
          hasReferrerOfInserent: a,
          hasReferrerOfCandidate: b,
        });
        const sum =
          r.inserentCents +
          r.candidateCents +
          r.referrerOfInserentCents +
          r.referrerOfCandidateCents +
          r.platformCents;
        expect(sum).toBe(total);
      });
    }
  }
});

describe("assertFixedSplit", () => {
  it("akzeptiert den verbindlichen Schlüssel", () => {
    expect(() => assertFixedSplit(FIXED_SPLIT_CONFIG)).not.toThrow();
  });

  it("wirft bei abweichendem Inserent-Anteil", () => {
    expect(() =>
      assertFixedSplit({ inserentBps: 5000, candidateBps: 3500, platformBps: 1500 }),
    ).toThrow("weicht vom verbindlichen Konzept-Schlüssel ab");
  });

  it("wirft bei 50/30/20 (auch wenn Summe stimmt)", () => {
    expect(() =>
      assertFixedSplit({ inserentBps: 5000, candidateBps: 3000, platformBps: 2000 }),
    ).toThrow();
  });
});
