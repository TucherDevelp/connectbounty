import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "server-only" wirft bei Import in Client/Test-Bundles. Wir neutralisieren
// es global im Test-Setup (siehe vitest.setup.ts), zusätzlich hier defensiv:
vi.mock("server-only", () => ({}));

const supabaseMock = {
  auth: { getUser: vi.fn() },
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => Promise.resolve(supabaseMock),
}));

import {
  ForbiddenError,
  UnauthenticatedError,
  getCurrentUser,
  hasAnyRole,
  hasRole,
  logAuditEvent,
  requireAnyRole,
  requireRole,
  requireUser,
} from "./roles";

beforeEach(() => {
  supabaseMock.auth.getUser.mockReset();
  supabaseMock.rpc.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getCurrentUser / requireUser", () => {
  it("returns user when session exists", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "a@b.de" } },
      error: null,
    });
    const u = await getCurrentUser();
    expect(u?.id).toBe("u1");
  });

  it("returns null when no session", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect(await getCurrentUser()).toBeNull();
  });

  it("requireUser throws UnauthenticatedError when no session", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe("hasRole / hasAnyRole", () => {
  it("hasRole calls RPC has_role with correct args", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await hasRole("admin")).toBe(true);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("has_role", { check_role: "admin" });
  });

  it("hasRole returns false when RPC returns null", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await hasRole("verified_user")).toBe(false);
  });

  it("hasRole rethrows RPC errors", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: new Error("boom") });
    await expect(hasRole("admin")).rejects.toThrow("boom");
  });

  it("hasAnyRole short-circuits empty array", async () => {
    expect(await hasAnyRole([])).toBe(false);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("hasAnyRole calls RPC has_any_role", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await hasAnyRole(["admin", "superadmin"])).toBe(true);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("has_any_role", {
      check_roles: ["admin", "superadmin"],
    });
  });
});

describe("requireRole / requireAnyRole", () => {
  it("requireRole resolves silently when role is present", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u1" } },
      error: null,
    });
    supabaseMock.rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(requireRole("admin")).resolves.toBeUndefined();
  });

  it("requireRole throws ForbiddenError when role missing", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u1" } },
      error: null,
    });
    supabaseMock.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(requireRole("admin")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requireAnyRole throws Unauthenticated before checking roles", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(requireAnyRole(["admin"])).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });
});

describe("logAuditEvent", () => {
  it("calls log_audit_event RPC with normalized args", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: 42, error: null });
    const id = await logAuditEvent({ action: "user.login" });
    expect(id).toBe(42);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("log_audit_event", {
      p_action: "user.login",
      p_target: null,
      p_metadata: {},
    });
  });

  it("forwards targetId and metadata", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: 7, error: null });
    await logAuditEvent({
      action: "admin.action",
      targetId: "11111111-1111-1111-1111-111111111111",
      metadata: { reason: "test" },
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith("log_audit_event", {
      p_action: "admin.action",
      p_target: "11111111-1111-1111-1111-111111111111",
      p_metadata: { reason: "test" },
    });
  });
});
