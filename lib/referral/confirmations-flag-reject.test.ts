/**
 * Unit-Tests für:
 *   - flagApplicationSubmittedAction  (Kandidat flaggt Bewerbungseinreichung)
 *   - rejectWithDocumentAction        (Inserent lädt Ablehnungsschreiben hoch)
 *
 * Muster analog lib/referral/actions.test.ts.
 * Supabase-Clients werden vollständig gemockt — kein echter DB-Zugriff.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted Mocks ───────────────────────────────────────────────────────────
const {
  supabaseServerFrom,
  supabaseServiceFrom,
  logAuditEventMock,
  requireUserMock,
  cookiesMock,
} = vi.hoisted(() => ({
  supabaseServerFrom: vi.fn(),
  supabaseServiceFrom: vi.fn(),
  logAuditEventMock: vi.fn(),
  requireUserMock: vi.fn(),
  cookiesMock: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "de" }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => Promise.resolve({ from: supabaseServerFrom }),
  getSupabaseServiceRoleClient: () => ({ from: supabaseServiceFrom }),
}));

vi.mock("@/lib/auth/roles", () => ({
  requireUser: requireUserMock,
  logAuditEvent: logAuditEventMock,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ── Testhelfer ───────────────────────────────────────────────────────────────

import { idleAction } from "@/lib/auth/action-result";
import {
  flagApplicationSubmittedAction,
  rejectWithDocumentAction,
} from "./confirmations";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

/**
 * Baut einen Supabase-QueryBuilder-Stub, der einen einzelnen Rückgabewert hat.
 * Alle chainbaren Methoden (select, eq, update, insert, maybeSingle, single…)
 * geben denselben Proxy zurück; der `.then`-Handler liefert `result`.
 */
function makeBuilder(result: { data: unknown; error: unknown | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (onFulfilled: (v: unknown) => unknown) =>
            Promise.resolve(onFulfilled(result));
        }
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args });
          return chain;
        };
      },
    },
  );
  return { chain, calls };
}

// ── IDs & Fixtures ──────────────────────────────────────────────────────────
const BOUNTY_ID   = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REFERRAL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const KANDIDAT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const INSERENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const FLAG_FD = fd({ referralId: REFERRAL_ID });

const REJECT_FD = fd({
  referralId:   REFERRAL_ID,
  storagePath:  `${REFERRAL_ID}/rejection.pdf`,
  originalName: "Ablehnungsschreiben.pdf",
  mimeType:     "application/pdf",
  fileSize:     "12345",
  reason:       "Leider müssen wir Ihre Bewerbung nach eingehender Prüfung absagen.",
});

// ── beforeEach / afterEach ──────────────────────────────────────────────────
beforeEach(() => {
  supabaseServerFrom.mockReset();
  supabaseServiceFrom.mockReset();
  logAuditEventMock.mockReset();
  requireUserMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

// ── flagApplicationSubmittedAction ──────────────────────────────────────────

describe("flagApplicationSubmittedAction", () => {
  it("blockt wenn kein User eingeloggt", async () => {
    requireUserMock.mockRejectedValueOnce(new Error("unauth"));
    const res = await flagApplicationSubmittedAction(idleAction, FLAG_FD);
    expect(res.status).toBe("error");
    expect(supabaseServerFrom).not.toHaveBeenCalled();
  });

  it("blockt bei ungültiger referralId", async () => {
    requireUserMock.mockResolvedValueOnce({ id: KANDIDAT_ID });
    const res = await flagApplicationSubmittedAction(
      idleAction,
      fd({ referralId: "not-a-uuid" }),
    );
    expect(res.status).toBe("error");
  });

  it("blockt wenn Referral nicht zu Kandidat gehört (kein Row zurück)", async () => {
    requireUserMock.mockResolvedValueOnce({ id: KANDIDAT_ID });
    const { chain } = makeBuilder({ data: null, error: null });
    supabaseServerFrom.mockReturnValueOnce(chain);

    const res = await flagApplicationSubmittedAction(idleAction, FLAG_FD);
    expect(res.status).toBe("error");
  });

  it("ist idempotent wenn application_submitted_at bereits gesetzt", async () => {
    requireUserMock.mockResolvedValueOnce({ id: KANDIDAT_ID });
    const referral = {
      id: REFERRAL_ID,
      bounty_id: BOUNTY_ID,
      status: "invoice_pending",
      candidate_user_id: KANDIDAT_ID,
      application_submitted_at: "2026-01-01T10:00:00Z",
    };
    const { chain } = makeBuilder({ data: referral, error: null });
    supabaseServerFrom.mockReturnValueOnce(chain);

    const res = await flagApplicationSubmittedAction(idleAction, FLAG_FD);
    // Idempotent: kein Fehler, kein Update
    expect(res.status).toBe("ok");
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });

  it("setzt application_submitted_at und contact_released_at atomisch", async () => {
    requireUserMock.mockResolvedValueOnce({ id: KANDIDAT_ID });

    const referral = {
      id: REFERRAL_ID,
      bounty_id: BOUNTY_ID,
      status: "awaiting_data_forwarding",
      candidate_user_id: KANDIDAT_ID,
      application_submitted_at: null,
    };
    // Erster from()-Aufruf: SELECT
    const { chain: selectChain } = makeBuilder({ data: referral, error: null });
    // Zweiter from()-Aufruf: UPDATE
    const { chain: updateChain, calls: updateCalls } = makeBuilder({
      data: null,
      error: null,
    });
    supabaseServerFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    logAuditEventMock.mockResolvedValue(undefined);

    const res = await flagApplicationSubmittedAction(idleAction, FLAG_FD);

    expect(res.status).toBe("ok");

    // Update muss beide Zeitstempel setzen
    const updateArg = updateCalls.find((c) => c.method === "update")?.args[0] as Record<
      string,
      unknown
    >;
    expect(updateArg).toBeDefined();
    expect(updateArg.application_submitted_at).toBeTruthy();
    expect(updateArg.contact_released_at).toBeTruthy();
    expect(updateArg.application_submitted_by).toBe(KANDIDAT_ID);
    expect(updateArg.contact_released_by).toBe(KANDIDAT_ID);

    // Beide Audit-Events müssen geloggt werden
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "referral.application_flagged", targetId: REFERRAL_ID }),
    );
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "referral.contact_released", targetId: REFERRAL_ID }),
    );
  });

  it("gibt Fehler zurück wenn Update fehlschlägt", async () => {
    requireUserMock.mockResolvedValueOnce({ id: KANDIDAT_ID });
    const referral = {
      id: REFERRAL_ID,
      bounty_id: BOUNTY_ID,
      status: "awaiting_data_forwarding",
      candidate_user_id: KANDIDAT_ID,
      application_submitted_at: null,
    };
    const { chain: selectChain } = makeBuilder({ data: referral, error: null });
    const { chain: updateChain } = makeBuilder({
      data: null,
      error: { code: "23514", message: "constraint violation" },
    });
    supabaseServerFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    const res = await flagApplicationSubmittedAction(idleAction, FLAG_FD);
    expect(res.status).toBe("error");
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });
});

// ── rejectWithDocumentAction ────────────────────────────────────────────────

describe("rejectWithDocumentAction", () => {
  it("blockt wenn kein User eingeloggt", async () => {
    requireUserMock.mockRejectedValueOnce(new Error("unauth"));
    const res = await rejectWithDocumentAction(idleAction, REJECT_FD);
    expect(res.status).toBe("error");
  });

  it("blockt wenn Referral nicht gefunden oder User nicht Owner", async () => {
    requireUserMock.mockResolvedValueOnce({ id: INSERENT_ID });
    // maybeSingle gibt null zurück → kein Referral für diesen Owner
    const { chain } = makeBuilder({ data: null, error: null });
    supabaseServerFrom.mockReturnValueOnce(chain);

    const res = await rejectWithDocumentAction(idleAction, REJECT_FD);
    expect(res.status).toBe("error");
  });

  it("blockt wenn contact_released_at noch nicht gesetzt (anonyme Phase)", async () => {
    requireUserMock.mockResolvedValueOnce({ id: INSERENT_ID });
    const referral = {
      id: REFERRAL_ID,
      bounty_id: BOUNTY_ID,
      status: "awaiting_data_forwarding",
      contact_released_at: null,
      bounties: { owner_id: INSERENT_ID },
    };
    const { chain } = makeBuilder({ data: referral, error: null });
    supabaseServerFrom.mockReturnValueOnce(chain);

    const res = await rejectWithDocumentAction(idleAction, REJECT_FD);
    expect(res.status).toBe("error");
  });

  it("blockt bei ungültigem storage_path (muss mit referralId beginnen)", async () => {
    requireUserMock.mockResolvedValueOnce({ id: INSERENT_ID });
    const referral = {
      id: REFERRAL_ID,
      bounty_id: BOUNTY_ID,
      status: "awaiting_data_forwarding",
      contact_released_at: "2026-01-02T00:00:00Z",
      bounties: { owner_id: INSERENT_ID },
    };
    const { chain } = makeBuilder({ data: referral, error: null });
    supabaseServerFrom.mockReturnValueOnce(chain);

    const badFd = fd({ ...Object.fromEntries(REJECT_FD.entries()), storagePath: "invalid/path.pdf" });
    const res = await rejectWithDocumentAction(idleAction, badFd);
    expect(res.status).toBe("error");
  });

  it("blockt wenn Referral bereits abgelehnt ist", async () => {
    requireUserMock.mockResolvedValueOnce({ id: INSERENT_ID });
    const referral = {
      id: REFERRAL_ID,
      bounty_id: BOUNTY_ID,
      status: "rejected",
      contact_released_at: "2026-01-02T00:00:00Z",
      bounties: { owner_id: INSERENT_ID },
    };
    const { chain } = makeBuilder({ data: referral, error: null });
    supabaseServerFrom.mockReturnValueOnce(chain);

    const res = await rejectWithDocumentAction(idleAction, REJECT_FD);
    expect(res.status).toBe("error");
  });

  it("persistiert Dokument, setzt Status 'rejected', loggt Audit-Events", async () => {
    requireUserMock.mockResolvedValueOnce({ id: INSERENT_ID });
    const referral = {
      id: REFERRAL_ID,
      bounty_id: BOUNTY_ID,
      status: "awaiting_data_forwarding",
      contact_released_at: "2026-01-02T00:00:00Z",
      bounties: { owner_id: INSERENT_ID },
    };
    // SELECT (user client)
    const { chain: selectChain } = makeBuilder({ data: referral, error: null });
    supabaseServerFrom.mockReturnValueOnce(selectChain);

    // service-role: rejection_documents INSERT
    const { chain: docInsertChain, calls: docCalls } = makeBuilder({ data: null, error: null });
    // service-role: bounty_referrals UPDATE
    const { chain: statusUpdateChain, calls: statusCalls } = makeBuilder({ data: null, error: null });
    // service-role: referral_rejections INSERT
    const { chain: auditInsertChain } = makeBuilder({ data: null, error: null });
    supabaseServiceFrom
      .mockReturnValueOnce(docInsertChain)
      .mockReturnValueOnce(statusUpdateChain)
      .mockReturnValueOnce(auditInsertChain);

    logAuditEventMock.mockResolvedValue(undefined);

    const res = await rejectWithDocumentAction(idleAction, REJECT_FD);
    expect(res.status).toBe("ok");

    // Dokument-Insert geprüft
    const docInsert = docCalls.find((c) => c.method === "insert")?.args[0] as Record<string, unknown>;
    expect(docInsert?.referral_id).toBe(REFERRAL_ID);
    expect(docInsert?.uploaded_by).toBe(INSERENT_ID);
    expect(docInsert?.storage_path).toBe(`${REFERRAL_ID}/rejection.pdf`);

    // Status-Update geprüft
    const statusUpdate = statusCalls.find((c) => c.method === "update")?.args[0] as Record<string, unknown>;
    expect(statusUpdate?.status).toBe("rejected");
    expect(statusUpdate?.rejection_reason).toBeTruthy();

    // Audit-Events
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "referral.rejection_uploaded", targetId: REFERRAL_ID }),
    );
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "referral.confirmation_rejected", targetId: REFERRAL_ID }),
    );
  });

  it("gibt Fehler zurück wenn Dokument-Insert fehlschlägt", async () => {
    requireUserMock.mockResolvedValueOnce({ id: INSERENT_ID });
    const referral = {
      id: REFERRAL_ID,
      bounty_id: BOUNTY_ID,
      status: "awaiting_data_forwarding",
      contact_released_at: "2026-01-02T00:00:00Z",
      bounties: { owner_id: INSERENT_ID },
    };
    const { chain: selectChain } = makeBuilder({ data: referral, error: null });
    supabaseServerFrom.mockReturnValueOnce(selectChain);

    const { chain: docInsertChain } = makeBuilder({
      data: null,
      error: { code: "23503", message: "foreign key violation" },
    });
    supabaseServiceFrom.mockReturnValueOnce(docInsertChain);

    const res = await rejectWithDocumentAction(idleAction, REJECT_FD);
    expect(res.status).toBe("error");
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });
});
