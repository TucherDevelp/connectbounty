import { describe, expect, it, vi } from "vitest";

// next/server importiert Edge-Runtime-Symbole, die in jsdom nicht verfügbar
// sind. Wir mocken NextResponse.next minimal, sodass headers-Logik testbar
// bleibt und proxy() lokal ausgeführt werden kann.
vi.mock("next/server", () => {
  class StubResponse {
    headers = new Map<string, string>();
    cookies = { set: () => {} };
  }
  return {
    NextResponse: {
      next: () => new StubResponse(),
    },
  };
});

// Den Supabase-Refresh mocken – getestet wird in einer eigenen Suite.
vi.mock("@/lib/supabase/middleware", () => ({
  updateSupabaseSession: async () => {
    const { NextResponse } = await import("next/server");
    return NextResponse.next();
  },
}));

import { proxy } from "./proxy";

function makeRequest(url = "https://example.com/") {
  return {
    url,
    nextUrl: new URL(url),
    cookies: { getAll: () => [], set: () => {} },
  } as unknown as import("next/server").NextRequest;
}

describe("proxy() – security headers", () => {
  it("sets HSTS, content-type-options, frame-options, referrer-policy", async () => {
    const res = await proxy(makeRequest());
    const h = res.headers as unknown as Map<string, string>;

    expect(h.get("Strict-Transport-Security")).toContain("max-age=");
    expect(h.get("X-Content-Type-Options")).toBe("nosniff");
    expect(h.get("X-Frame-Options")).toBe("DENY");
    expect(h.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("sets a restrictive Content-Security-Policy", async () => {
    const res = await proxy(makeRequest());
    const h = res.headers as unknown as Map<string, string>;
    const csp = h.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
