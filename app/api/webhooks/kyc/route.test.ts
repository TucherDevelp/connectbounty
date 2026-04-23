import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

const { serviceClient, rpcMock, insertMock } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  const insertMock = vi.fn();
  const serviceClient = {
    rpc: rpcMock,
    from: vi.fn(() => ({ insert: insertMock })),
  };
  return { serviceClient, rpcMock, insertMock };
});

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServiceRoleClient: () => serviceClient,
  getSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/auth/roles", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/env", () => ({
  serverEnv: () => ({
    KYC_WEBHOOK_SECRET: "test-secret-min-16-chars",
    KYC_PROVIDER: "mock",
    NODE_ENV: "test",
  }),
  clientEnv: () => ({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }),
}));

import { POST } from "./route";
import { __resetKycProviderCache } from "@/lib/kyc/provider";

function sign(body: string): string {
  return createHmac("sha256", "test-secret-min-16-chars").update(body).digest("hex");
}

beforeEach(() => {
  rpcMock.mockReset();
  insertMock.mockReset();
  __resetKycProviderCache();
});

describe("POST /api/webhooks/kyc", () => {
  it("returns 401 when signature is missing", async () => {
    const body = '{"applicantId":"x","type":"applicantApproved"}';
    const res = await POST(new Request("http://x/api/webhooks/kyc", { method: "POST", body }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature is wrong", async () => {
    const body = '{"applicantId":"x","type":"applicantApproved"}';
    const res = await POST(
      new Request("http://x/api/webhooks/kyc", {
        method: "POST",
        body,
        headers: { "x-kyc-signature": "bad" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("calls update_kyc_status + audit insert on valid approved event", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    insertMock.mockResolvedValueOnce({ error: null });

    const body = JSON.stringify({ applicantId: "app-ok", type: "applicantApproved" });
    const res = await POST(
      new Request("http://x/api/webhooks/kyc", {
        method: "POST",
        body,
        headers: { "x-kyc-signature": sign(body) },
      }),
    );

    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith(
      "update_kyc_status",
      expect.objectContaining({ p_applicant_id: "app-ok", p_status: "approved" }),
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc.approved" }),
    );
  });

  it("returns 500 when RPC fails", async () => {
    rpcMock.mockResolvedValueOnce({ error: { message: "db down" } });
    const body = JSON.stringify({ applicantId: "app-x", type: "applicantApproved" });
    const res = await POST(
      new Request("http://x/api/webhooks/kyc", {
        method: "POST",
        body,
        headers: { "x-kyc-signature": sign(body) },
      }),
    );
    expect(res.status).toBe(500);
  });

  it("maps rejected event to audit action kyc.rejected and passes reject labels", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    insertMock.mockResolvedValueOnce({ error: null });

    const body = JSON.stringify({
      applicantId: "app-rej",
      type: "applicantRejected",
      rejectLabels: ["FORGERY"],
    });
    await POST(
      new Request("http://x/api/webhooks/kyc", {
        method: "POST",
        body,
        headers: { "x-kyc-signature": sign(body) },
      }),
    );

    expect(rpcMock).toHaveBeenCalledWith(
      "update_kyc_status",
      expect.objectContaining({ p_reject_labels: ["FORGERY"] }),
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc.rejected" }),
    );
  });
});
