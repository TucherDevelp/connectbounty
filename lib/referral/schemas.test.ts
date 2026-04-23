import { describe, expect, it } from "vitest";
import {
  referralIdSchema,
  referralStatusUpdateSchema,
  referralSubmitSchema,
} from "./schemas";

const UUID = "11111111-1111-4111-8111-111111111111";

const base = {
  bountyId: UUID,
  candidateName: "Ada Lovelace",
  candidateEmail: "ada@example.com",
  candidateContact: "linkedin.com/in/ada",
  message: "Erfahrene Engineerin, starke Referenz.",
};

describe("referralSubmitSchema", () => {
  it("akzeptiert valide Eingabe", () => {
    const res = referralSubmitSchema.safeParse(base);
    expect(res.success).toBe(true);
  });

  it("leere optionale Felder → null", () => {
    const res = referralSubmitSchema.safeParse({
      ...base,
      candidateContact: "",
      message: "",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.candidateContact).toBeNull();
      expect(res.data.message).toBeNull();
    }
  });

  it("weist ungültige E-Mail ab", () => {
    const res = referralSubmitSchema.safeParse({ ...base, candidateEmail: "keine-email" });
    expect(res.success).toBe(false);
  });

  it("weist zu kurzen Namen ab", () => {
    const res = referralSubmitSchema.safeParse({ ...base, candidateName: "A" });
    expect(res.success).toBe(false);
  });

  it("weist zu lange Nachricht ab", () => {
    const res = referralSubmitSchema.safeParse({ ...base, message: "x".repeat(2001) });
    expect(res.success).toBe(false);
  });

  it("weist Non-UUID bounty ab", () => {
    const res = referralSubmitSchema.safeParse({ ...base, bountyId: "nope" });
    expect(res.success).toBe(false);
  });
});

describe("referralStatusUpdateSchema", () => {
  it("akzeptiert valide Zielstati", () => {
    for (const status of ["contacted", "interviewing", "hired", "paid", "rejected"]) {
      const res = referralStatusUpdateSchema.safeParse({ id: UUID, status });
      expect(res.success, `status=${status}`).toBe(true);
    }
  });

  it("lehnt submitted/withdrawn ab (UI soll diese Pfade nicht anbieten)", () => {
    for (const status of ["submitted", "withdrawn"]) {
      const res = referralStatusUpdateSchema.safeParse({ id: UUID, status });
      expect(res.success).toBe(false);
    }
  });
});

describe("referralIdSchema", () => {
  it("akzeptiert UUID", () => {
    expect(referralIdSchema.safeParse({ id: UUID }).success).toBe(true);
  });
});
