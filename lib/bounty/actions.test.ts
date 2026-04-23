import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted Mocks ──────────────────────────────────────────────────────────
const {
  supabaseFrom,
  supabaseAuthGetUser,
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
    supabaseAuthGetUser: vi.fn(),
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
  getSupabaseServerClient: () =>
    Promise.resolve({ auth: { getUser: supabaseAuthGetUser }, from: supabaseFrom }),
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
  cancelBountyAction,
  closeBountyAction,
  createBountyAction,
  deleteBountyAction,
  publishBountyAction,
} from "./actions";

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.set(k, v);
  return form;
}

// Baut einen Supabase-Query-Builder, der .insert/.select/.single sowie
// beliebig viele .eq/.in-Verkettungen unterstützt.
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

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const VALID_INPUT = {
  title: "Senior Backend Engineer bei ConnectBounty",
  description:
    "Wir suchen einen Backend-Engineer mit Fokus auf Node.js, Postgres und Supabase-RLS.",
  bonusAmount: "1500",
  bonusCurrency: "EUR",
  location: "Berlin",
  industry: "Software",
  tags: "node,postgres",
  expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
};

beforeEach(() => {
  supabaseFrom.mockReset();
  supabaseAuthGetUser.mockReset();
  redirectMock.mockClear();
  logAuditEventMock.mockReset();
  requireKycApprovedMock.mockReset();
  requireUserMock.mockReset();
});

afterEach(() => vi.restoreAllMocks());

// ── createBountyAction ─────────────────────────────────────────────────────

describe("createBountyAction", () => {
  it("blockt ohne KYC mit freundlicher Fehlermeldung", async () => {
    requireKycApprovedMock.mockRejectedValueOnce(new MockKycRequiredError());
    const res = await createBountyAction(idleAction, fd(VALID_INPUT));
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.message).toMatch(/KYC/);
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it("blockt ohne Session", async () => {
    requireKycApprovedMock.mockRejectedValueOnce(new MockUnauthenticatedError());
    const res = await createBountyAction(idleAction, fd(VALID_INPUT));
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.message).toMatch(/melde dich an/);
  });

  it("liefert Feld-Fehler bei ungültiger Eingabe", async () => {
    requireKycApprovedMock.mockResolvedValueOnce(undefined);
    const res = await createBountyAction(
      idleAction,
      fd({ ...VALID_INPUT, bonusAmount: "-1" }),
    );
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.fieldErrors?.bonusAmount).toBeTruthy();
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it("insertet valide Bounty als draft, loggt Audit und redirected", async () => {
    requireKycApprovedMock.mockResolvedValueOnce(undefined);
    requireUserMock.mockResolvedValueOnce({ id: "user-1" });

    const { chain, calls } = makeBuilder({ data: { id: "bounty-123" }, error: null });
    supabaseFrom.mockReturnValueOnce(chain);

    await expect(createBountyAction(idleAction, fd(VALID_INPUT))).rejects.toThrow(
      "__NEXT_REDIRECT__",
    );

    expect(supabaseFrom).toHaveBeenCalledWith("bounties");
    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall).toBeDefined();
    const insertArg = insertCall!.args[0] as Record<string, unknown>;
    expect(insertArg.owner_id).toBe("user-1");
    expect(insertArg.bonus_amount).toBe(1500);
    expect(insertArg.status).toBe("draft");
    expect(insertArg.tags).toEqual(["node", "postgres"]);

    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "bounty.created", targetId: "bounty-123" }),
    );
    expect(redirectMock).toHaveBeenCalledWith("/bounties/mine?created=bounty-123");
  });

  it("gibt generischen Fehler zurück, wenn DB ablehnt (RLS etc.)", async () => {
    requireKycApprovedMock.mockResolvedValueOnce(undefined);
    requireUserMock.mockResolvedValueOnce({ id: "user-1" });
    const { chain } = makeBuilder({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    supabaseFrom.mockReturnValueOnce(chain);

    const res = await createBountyAction(idleAction, fd(VALID_INPUT));
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.message).toMatch(/nicht gespeichert/);
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });
});

// ── publishBountyAction ────────────────────────────────────────────────────

describe("publishBountyAction", () => {
  it("redirected ohne KYC zur mine-Seite mit error-Param", async () => {
    requireKycApprovedMock.mockRejectedValueOnce(new MockKycRequiredError());
    await expect(publishBountyAction(fd({ id: VALID_ID }))).rejects.toThrow(
      "__NEXT_REDIRECT__",
    );
    expect(redirectMock).toHaveBeenCalledWith("/bounties/mine?error=kyc_required");
  });

  it("updated status auf open und published_at, redirected auf published-URL", async () => {
    requireKycApprovedMock.mockResolvedValueOnce(undefined);
    const { chain, calls } = makeBuilder({ data: null, error: null });
    supabaseFrom.mockReturnValueOnce(chain);

    await expect(publishBountyAction(fd({ id: VALID_ID }))).rejects.toThrow(
      "__NEXT_REDIRECT__",
    );

    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall).toBeDefined();
    const updArg = updateCall!.args[0] as Record<string, unknown>;
    // Nach Approval-Workflow: Publish → pending_review (nicht direkt open)
    expect(updArg.status).toBe("pending_review");
    expect(updArg.published_at).toBeUndefined();

    // .eq("id", VALID_ID).eq("status", "draft")
    const eqCalls = calls.filter((c) => c.method === "eq");
    expect(eqCalls).toHaveLength(2);
    expect(eqCalls[0]!.args).toEqual(["id", VALID_ID]);
    expect(eqCalls[1]!.args).toEqual(["status", "draft"]);

    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "bounty.published", targetId: VALID_ID }),
    );
    expect(redirectMock).toHaveBeenCalledWith(`/bounties/mine?pending=${VALID_ID}`);
  });

  it("invalid_id-Redirect bei nicht-UUID", async () => {
    await expect(publishBountyAction(fd({ id: "not-uuid" }))).rejects.toThrow(
      "__NEXT_REDIRECT__",
    );
    expect(redirectMock).toHaveBeenCalledWith("/bounties/mine?error=invalid_id");
    expect(supabaseFrom).not.toHaveBeenCalled();
  });
});

// ── closeBountyAction ──────────────────────────────────────────────────────

describe("closeBountyAction", () => {
  it("setzt status closed + closed_at, eq-Gates prüfen open-Status", async () => {
    requireUserMock.mockResolvedValueOnce({ id: "user-1" });
    const { chain, calls } = makeBuilder({ data: null, error: null });
    supabaseFrom.mockReturnValueOnce(chain);

    await expect(closeBountyAction(fd({ id: VALID_ID }))).rejects.toThrow(
      "__NEXT_REDIRECT__",
    );

    const upd = calls.find((c) => c.method === "update")!.args[0] as Record<string, unknown>;
    expect(upd.status).toBe("closed");
    expect(typeof upd.closed_at).toBe("string");

    const eqCalls = calls.filter((c) => c.method === "eq");
    expect(eqCalls[1]!.args).toEqual(["status", "open"]);

    expect(redirectMock).toHaveBeenCalledWith(`/bounties/mine?closed=${VALID_ID}`);
  });
});

// ── cancelBountyAction ─────────────────────────────────────────────────────

describe("cancelBountyAction", () => {
  it("akzeptiert draft oder open als Quellstatus via .in()", async () => {
    requireUserMock.mockResolvedValueOnce({ id: "user-1" });
    const { chain, calls } = makeBuilder({ data: null, error: null });
    supabaseFrom.mockReturnValueOnce(chain);

    await expect(cancelBountyAction(fd({ id: VALID_ID }))).rejects.toThrow(
      "__NEXT_REDIRECT__",
    );

    const inCall = calls.find((c) => c.method === "in");
    expect(inCall?.args).toEqual(["status", ["draft", "pending_review", "open"]]);
    expect(redirectMock).toHaveBeenCalledWith(`/bounties/mine?cancelled=${VALID_ID}`);
  });
});

// ── deleteBountyAction ─────────────────────────────────────────────────────

describe("deleteBountyAction", () => {
  it("löscht nur im Draft-Zustand (zusätzlicher Filter über RLS hinaus)", async () => {
    requireUserMock.mockResolvedValueOnce({ id: "user-1" });
    const { chain, calls } = makeBuilder({ data: null, error: null });
    supabaseFrom.mockReturnValueOnce(chain);

    await expect(deleteBountyAction(fd({ id: VALID_ID }))).rejects.toThrow(
      "__NEXT_REDIRECT__",
    );

    const eqCalls = calls.filter((c) => c.method === "eq");
    expect(eqCalls[0]!.args).toEqual(["id", VALID_ID]);
    expect(eqCalls[1]!.args).toEqual(["status", "draft"]);
    expect(calls.some((c) => c.method === "delete")).toBe(true);

    expect(redirectMock).toHaveBeenCalledWith(`/bounties/mine?deleted=${VALID_ID}`);
  });
});
