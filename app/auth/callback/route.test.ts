import { describe, expect, it, vi } from "vitest";

const { supabaseAuth, logAuditEventMock } = vi.hoisted(() => ({
  supabaseAuth: { exchangeCodeForSession: vi.fn() },
  logAuditEventMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => Promise.resolve({ auth: supabaseAuth }),
}));
vi.mock("@/lib/auth/roles", () => ({ logAuditEvent: logAuditEventMock }));

import { GET } from "./route";

function req(search: string) {
  return new Request(`http://localhost:3000/auth/callback${search}`);
}

describe("GET /auth/callback", () => {
  it("redirects to /login?error=missing_code if no code", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("missing_code");
  });

  it("redirects to /login?error=callback_failed if exchangeCodeForSession errors", async () => {
    supabaseAuth.exchangeCodeForSession.mockResolvedValueOnce({ error: new Error("expired") });
    const res = await GET(req("?code=bad"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("callback_failed");
  });

  it("redirects to / by default after successful exchange", async () => {
    supabaseAuth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    logAuditEventMock.mockResolvedValueOnce(1);
    const res = await GET(req("?code=good"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("respects ?next= for safe local paths", async () => {
    supabaseAuth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    logAuditEventMock.mockResolvedValueOnce(1);
    const res = await GET(req("?code=good&next=/reset/confirm"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/reset/confirm");
  });

  it("ignores ?next= that starts with //  (open-redirect guard)", async () => {
    supabaseAuth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    logAuditEventMock.mockResolvedValueOnce(1);
    const res = await GET(req("?code=good&next=//evil.com/phish"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("logs audit event user.login with provider", async () => {
    supabaseAuth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    logAuditEventMock.mockResolvedValueOnce(1);
    await GET(req("?code=good&provider=google"));
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.login",
        metadata: expect.objectContaining({ provider: "google" }),
      }),
    );
  });

  it("proceeds even if audit logging throws", async () => {
    supabaseAuth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    logAuditEventMock.mockRejectedValueOnce(new Error("db down"));
    const res = await GET(req("?code=good"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });
});
