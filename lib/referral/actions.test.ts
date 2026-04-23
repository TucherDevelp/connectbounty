import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  supabaseFrom,
  redirectMock,
  logAuditEventMock,
  requireKycApprovedMock,
  requireUserMock,
  MockUnauthenticatedError,
  MockKycRequiredError,
} = vi.hoisted(() => {
  class UnauthenticatedError extends Error {
    constructor() {
      super("unauth");
      this.name = "UnauthenticatedError";
    }
  }
  class KycRequiredError extends Error {
    constructor() {
      super("kyc");
      this.name = "KycRequiredError";
    }
  }
  return {
    supabaseFrom: vi.fn(),
    redirectMock: vi.fn((url: string) => {
      void url;
      throw new Error("__NEXT_REDIRECT__");
    }),
    logAuditEventMock: vi.fn(),
    requireKycApprovedMock: vi.fn(),
    requireUserMock: vi.fn(),
    MockUnauthenticatedError: UnauthenticatedError,
    MockKycRequiredError: KycRequiredError,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => Promise.resolve({ from: supabaseFrom }),
}));

vi.mock("@/lib/auth/roles", () => ({
  requireKycApproved: requireKycApprovedMock,
  requireUser: requireUserMock,
  logAuditEvent: logAuditEventMock,
  KycRequiredError: MockKycRequiredError,
  UnauthenticatedError: MockUnauthenticatedError,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { idleAction } from "@/lib/auth/action-result";
import {
  submitReferralAction,
  updateReferralStatusAction,
  withdrawReferralAction,
} from "./actions";

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.set(k, v);
  return form;
}

function makeBuilder(result: { data: unknown; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const thenable: Record<string, unknown> = {};
  const chain = new Proxy(thenable, {
    get(_t, prop) {
      if (prop === "then") {
        return (onFulfilled: (v: unknown) => unknown) => onFulfilled(result);
      }
      return (...args: unknown[]) => {
        calls.push({ method: String(prop), args });
        return chain;
      };
    },
  });
  return { chain, calls };
}

const BOUNTY_ID = "11111111-1111-4111-8111-111111111111";
const REFERRAL_ID = "22222222-2222-4222-8222-222222222222";
const VALID_SUBMIT = {
  bountyId: BOUNTY_ID,
  candidateName: "Ada Lovelace",
  candidateEmail: "ada@example.com",
  candidateContact: "",
  message: "",
};

beforeEach(() => {
  supabaseFrom.mockReset();
  redirectMock.mockClear();
  logAuditEventMock.mockReset();
  requireKycApprovedMock.mockReset();
  requireUserMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

// ── submitReferralAction ──────────────────────────────────────────────────

describe("submitReferralAction", () => {
  it("blockt ohne KYC", async () => {
    requireKycApprovedMock.mockRejectedValueOnce(new MockKycRequiredError());
    const res = await submitReferralAction(idleAction, fd(VALID_SUBMIT));
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.message).toMatch(/KYC/);
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it("blockt ohne Session", async () => {
    requireKycApprovedMock.mockRejectedValueOnce(new MockUnauthenticatedError());
    const res = await submitReferralAction(idleAction, fd(VALID_SUBMIT));
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.message).toMatch(/melde dich an/);
  });

  it("validiert E-Mail-Format", async () => {
    requireKycApprovedMock.mockResolvedValueOnce(undefined);
    const res = await submitReferralAction(
      idleAction,
      fd({ ...VALID_SUBMIT, candidateEmail: "no-email" }),
    );
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.fieldErrors?.candidateEmail).toBeTruthy();
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it("insertet valide Empfehlung, loggt Audit, redirected", async () => {
    requireKycApprovedMock.mockResolvedValueOnce(undefined);
    requireUserMock.mockResolvedValueOnce({ id: "user-1" });

    const { chain, calls } = makeBuilder({
      data: { id: REFERRAL_ID },
      error: null,
    });
    supabaseFrom.mockReturnValueOnce(chain);

    await expect(submitReferralAction(idleAction, fd(VALID_SUBMIT))).rejects.toThrow(
      "__NEXT_REDIRECT__",
    );

    expect(supabaseFrom).toHaveBeenCalledWith("bounty_referrals");
    const insert = calls.find((c) => c.method === "insert")!.args[0] as Record<string, unknown>;
    expect(insert.bounty_id).toBe(BOUNTY_ID);
    expect(insert.referrer_id).toBe("user-1");
    expect(insert.candidate_email).toBe("ada@example.com");
    // Nach Approval-Workflow: Referral startet als pending_review
    expect(insert.status).toBe("pending_review");
    expect(insert.candidate_contact).toBeNull();
    expect(insert.message).toBeNull();

    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "referral.submitted", targetId: REFERRAL_ID }),
    );
    expect(redirectMock).toHaveBeenCalledWith(
      `/referrals/mine?submitted=${REFERRAL_ID}`,
    );
  });

  it("unique-violation → spezifische Meldung", async () => {
    requireKycApprovedMock.mockResolvedValueOnce(undefined);
    requireUserMock.mockResolvedValueOnce({ id: "user-1" });
    const { chain } = makeBuilder({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });
    supabaseFrom.mockReturnValueOnce(chain);

    const res = await submitReferralAction(idleAction, fd(VALID_SUBMIT));
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.message).toMatch(/bereits/);
  });

  it("generischer RLS-Fehler → neutrale Meldung", async () => {
    requireKycApprovedMock.mockResolvedValueOnce(undefined);
    requireUserMock.mockResolvedValueOnce({ id: "user-1" });
    const { chain } = makeBuilder({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    supabaseFrom.mockReturnValueOnce(chain);

    const res = await submitReferralAction(idleAction, fd(VALID_SUBMIT));
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.message).toMatch(/nicht gespeichert/);
  });
});

// ── withdrawReferralAction ────────────────────────────────────────────────

describe("withdrawReferralAction", () => {
  it("invalid_id-Redirect bei Nicht-UUID", async () => {
    await expect(withdrawReferralAction(fd({ id: "nope" }))).rejects.toThrow(
      "__NEXT_REDIRECT__",
    );
    expect(redirectMock).toHaveBeenCalledWith("/referrals/mine?error=invalid_id");
  });

  it("setzt status=withdrawn nur aus aktiven Stati, redirected & auditiert", async () => {
    requireUserMock.mockResolvedValueOnce({ id: "user-1" });
    const { chain, calls } = makeBuilder({
      data: { id: REFERRAL_ID, bounty_id: BOUNTY_ID },
      error: null,
    });
    supabaseFrom.mockReturnValueOnce(chain);

    await expect(withdrawReferralAction(fd({ id: REFERRAL_ID }))).rejects.toThrow(
      "__NEXT_REDIRECT__",
    );

    const upd = calls.find((c) => c.method === "update")!.args[0] as Record<string, unknown>;
    expect(upd.status).toBe("withdrawn");

    const inCall = calls.find((c) => c.method === "in");
    expect(inCall?.args).toEqual(["status", ["pending_review", "submitted", "contacted", "interviewing"]]);

    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "referral.withdrawn", targetId: REFERRAL_ID }),
    );
    expect(redirectMock).toHaveBeenCalledWith(
      `/referrals/mine?withdrawn=${REFERRAL_ID}`,
    );
  });
});

// ── updateReferralStatusAction ────────────────────────────────────────────

describe("updateReferralStatusAction", () => {
  it("lehnt unzulässigen Zielstatus ab (invalid_status)", async () => {
    await expect(
      updateReferralStatusAction(fd({ id: REFERRAL_ID, status: "withdrawn" })),
    ).rejects.toThrow("__NEXT_REDIRECT__");
    expect(redirectMock).toHaveBeenCalledWith("/bounties/mine?error=invalid_status");
  });

  it("setzt status + Zeitstempel (hired_at bei hired), redirected, auditiert", async () => {
    requireUserMock.mockResolvedValueOnce({ id: "user-1" });
    const { chain, calls } = makeBuilder({
      data: { id: REFERRAL_ID, bounty_id: BOUNTY_ID },
      error: null,
    });
    supabaseFrom.mockReturnValueOnce(chain);

    await expect(
      updateReferralStatusAction(fd({ id: REFERRAL_ID, status: "hired" })),
    ).rejects.toThrow("__NEXT_REDIRECT__");

    const upd = calls.find((c) => c.method === "update")!.args[0] as Record<string, unknown>;
    expect(upd.status).toBe("hired");
    expect(typeof upd.hired_at).toBe("string");
    expect(upd.paid_at).toBeUndefined();

    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "referral.status_changed", targetId: REFERRAL_ID }),
    );
    expect(redirectMock).toHaveBeenCalledWith(
      `/bounties/${BOUNTY_ID}?status_updated=${REFERRAL_ID}`,
    );
  });

  it("paid setzt paid_at", async () => {
    requireUserMock.mockResolvedValueOnce({ id: "user-1" });
    const { chain, calls } = makeBuilder({
      data: { id: REFERRAL_ID, bounty_id: BOUNTY_ID },
      error: null,
    });
    supabaseFrom.mockReturnValueOnce(chain);

    await expect(
      updateReferralStatusAction(fd({ id: REFERRAL_ID, status: "paid" })),
    ).rejects.toThrow("__NEXT_REDIRECT__");

    const upd = calls.find((c) => c.method === "update")!.args[0] as Record<string, unknown>;
    expect(typeof upd.paid_at).toBe("string");
  });

  it("DB-Fehler (Trigger blockt Übergang) → redirect auf mine?error", async () => {
    requireUserMock.mockResolvedValueOnce({ id: "user-1" });
    const { chain } = makeBuilder({
      data: null,
      error: { code: "P0001", message: "illegal transition" },
    });
    supabaseFrom.mockReturnValueOnce(chain);

    await expect(
      updateReferralStatusAction(fd({ id: REFERRAL_ID, status: "hired" })),
    ).rejects.toThrow("__NEXT_REDIRECT__");
    expect(redirectMock).toHaveBeenCalledWith("/bounties/mine?error=status_update_failed");
  });
});
