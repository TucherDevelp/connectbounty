import { describe, it, expect } from "vitest";
import { computeSplit, DEFAULT_SPLIT_CONFIG, REFERRER_SHARE_BPS, type SplitInput } from "./split";

const cfg = DEFAULT_SPLIT_CONFIG; // 40/40/20

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
  it("teilt 10 000 Cent korrekt auf (40/40/20)", () => {
    const r = computeSplit(input());
    expect(r.personACents).toBe(4000);
    expect(r.personBCents).toBe(4000);
    expect(r.refOfACents).toBe(0);
    expect(r.refOfBCents).toBe(0);
    expect(r.platformCents).toBe(2000);
    expect(r.totalCents).toBe(10_000);
  });

  it("Summe ergibt immer totalCents", () => {
    const r = computeSplit(input());
    const sum = r.personACents + r.personBCents + r.refOfACents + r.refOfBCents + r.platformCents;
    expect(sum).toBe(r.totalCents);
  });
});

describe("computeSplit - Referrer von A", () => {
  it("zieht 2,5 % für Referrer-A vom Plattform-Anteil", () => {
    const r = computeSplit(input({ hasReferrerOfA: true }));
    expect(r.refOfACents).toBe(Math.floor((10_000 * REFERRER_SHARE_BPS) / 10_000)); // 250
    expect(r.personACents).toBe(4000);
    expect(r.personBCents).toBe(4000);
    expect(r.platformCents).toBe(2000 - 250); // 1750
    const sum = r.personACents + r.personBCents + r.refOfACents + r.refOfBCents + r.platformCents;
    expect(sum).toBe(10_000);
  });
});

describe("computeSplit - beide Referrer", () => {
  it("zieht 2×2,5 % ab, Plattform behält 15 %", () => {
    const r = computeSplit(input({ hasReferrerOfA: true, hasReferrerOfB: true }));
    expect(r.refOfACents).toBe(250);
    expect(r.refOfBCents).toBe(250);
    expect(r.platformCents).toBe(1500);
    const sum = r.personACents + r.personBCents + r.refOfACents + r.refOfBCents + r.platformCents;
    expect(sum).toBe(10_000);
  });
});

describe("computeSplit - Rundungsrestverbleib bei Plattform", () => {
  it("verliert keinen Cent bei 333-Cent-Basis", () => {
    // 333 Cent: 40 % = 133,2 → floor = 133; 2×133 + 2×8 + rest = 333
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
      computeSplit(input({ splits: { referrerBps: 4000, candidateBps: 4000, platformBps: 1999 } })),
    ).toThrow("BPS-Summe");
  });

  it("wirft wenn platformBps < 500", () => {
    expect(() =>
      computeSplit(input({ splits: { referrerBps: 5000, candidateBps: 4700, platformBps: 300 } })),
    ).toThrow("platformBps muss mindestens 500");
  });
});

describe("computeSplit - benutzerdefinierter Split 50/30/20", () => {
  const custom = { referrerBps: 5000, candidateBps: 3000, platformBps: 2000 };

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
