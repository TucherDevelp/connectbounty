import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const { supabaseBuilders, serviceClient } = vi.hoisted(() => {
  /**
   * Supabase-Builder sind gleichzeitig "thenable" (man kann sie awaiten,
   * terminale Operation) UND chainable (select/eq/... geben ein weiteres
   * Builder-Objekt zurück). Wir modellieren das mit einer Chain, deren
   * `then` pro Test überschrieben werden kann.
   */
  const makeBuilder = () => {
    const chain = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
      then: vi.fn((resolve: (v: unknown) => void) => resolve({ error: null })),
    };
    for (const key of Object.keys(chain) as (keyof typeof chain)[]) {
      if (key !== "then") chain[key].mockReturnValue(chain);
    }
    return chain;
  };
  const profilesBuilder = makeBuilder();
  const applicantsBuilder = makeBuilder();
  const serviceClient = {
    from: vi.fn((table: string) =>
      table === "profiles" ? profilesBuilder : applicantsBuilder,
    ),
  };
  return {
    supabaseBuilders: { profiles: profilesBuilder, applicants: applicantsBuilder },
    serviceClient,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServiceRoleClient: () => serviceClient,
}));
vi.mock("@/lib/env", () => ({
  serverEnv: () => ({
    KYC_WEBHOOK_SECRET: "test-secret-min-16-chars",
    KYC_PROVIDER: "mock",
    NODE_ENV: "test",
  }),
  clientEnv: () => ({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }),
}));

import { MockProvider } from "./mock-provider";

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("MockProvider.startSession", () => {
  it("returns existing pending applicant if present (idempotent)", async () => {
    supabaseBuilders.applicants.maybeSingle.mockResolvedValueOnce({
      data: { applicant_id: "mock_existing", level_name: "mock-basic", status: "pending" },
      error: null,
    });

    const provider = new MockProvider();
    const session = await provider.startSession("user-123");

    expect(session.applicantId).toBe("mock_existing");
    expect(session.devSimulatable).toBe(true);
    expect(session.accessToken).toBeNull();
    expect(supabaseBuilders.applicants.insert).not.toHaveBeenCalled();
  });

  it("creates new applicant + sets profile kyc_status=pending", async () => {
    supabaseBuilders.applicants.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const provider = new MockProvider();
    const session = await provider.startSession("abcdef12-3456-7890");

    expect(session.applicantId).toMatch(/^mock_abcdef12_/);
    expect(supabaseBuilders.applicants.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "abcdef12-3456-7890",
        level_name: "mock-basic",
        status: "pending",
      }),
    );
    expect(supabaseBuilders.profiles.update).toHaveBeenCalledWith({ kyc_status: "pending" });
    expect(supabaseBuilders.profiles.eq).toHaveBeenCalledWith("id", "abcdef12-3456-7890");
  });
});

describe("MockProvider.parseWebhook", () => {
  const secret = "test-secret-min-16-chars";

  function sign(body: string): string {
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  it("throws when signature header is missing", () => {
    const provider = new MockProvider();
    expect(() => provider.parseWebhook('{"applicantId":"x","type":"applicantApproved"}', {})).toThrow(
      /missing signature/,
    );
  });

  it("throws when signature is wrong", () => {
    const provider = new MockProvider();
    const body = '{"applicantId":"x","type":"applicantApproved"}';
    expect(() =>
      provider.parseWebhook(body, { "x-kyc-signature": "deadbeef" }),
    ).toThrow(/invalid signature/);
  });

  it("parses valid approved event", () => {
    const provider = new MockProvider();
    const body = JSON.stringify({ applicantId: "app-1", type: "applicantApproved" });
    const out = provider.parseWebhook(body, { "x-kyc-signature": sign(body) });
    expect(out).toMatchObject({
      applicantId: "app-1",
      type: "applicantApproved",
      nextStatus: "approved",
    });
  });

  it("parses rejected event with labels", () => {
    const provider = new MockProvider();
    const body = JSON.stringify({
      applicantId: "app-2",
      type: "applicantRejected",
      rejectLabels: ["FORGERY", "DOCUMENT_PAGE_MISSING"],
    });
    const out = provider.parseWebhook(body, { "x-kyc-signature": sign(body) });
    expect(out.nextStatus).toBe("rejected");
    expect(out.rejectLabels).toEqual(["FORGERY", "DOCUMENT_PAGE_MISSING"]);
  });

  it("maps applicantExpired to status=expired", () => {
    const provider = new MockProvider();
    const body = JSON.stringify({ applicantId: "app-3", type: "applicantExpired" });
    const out = provider.parseWebhook(body, { "x-kyc-signature": sign(body) });
    expect(out.nextStatus).toBe("expired");
  });

  it("rejects invalid payload shape", () => {
    const provider = new MockProvider();
    const body = '{"foo":"bar"}';
    expect(() =>
      provider.parseWebhook(body, { "x-kyc-signature": sign(body) }),
    ).toThrow(/invalid payload shape/);
  });
});
