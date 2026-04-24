import { afterEach, describe, expect, it, vi } from "vitest";

// next/server-Stub mit Cookie-Jar und Header-Map.
vi.mock("next/server", () => {
  class CookieJar {
    private store = new Map<string, { name: string; value: string }>();
    getAll() {
      return Array.from(this.store.values());
    }
    set(arg: string | { name: string; value: string }, value?: string) {
      if (typeof arg === "string") {
        this.store.set(arg, { name: arg, value: value ?? "" });
      } else {
        this.store.set(arg.name, { name: arg.name, value: arg.value });
      }
    }
  }
  class StubResponse {
    constructor(
      public status = 200,
      public headers = new Map<string, string>(),
      public cookies = new CookieJar(),
    ) {}
    static next() {
      return new StubResponse();
    }
    static redirect(url: URL) {
      const r = new StubResponse(307);
      r.headers.set("location", url.toString());
      return r;
    }
  }
  return { NextResponse: StubResponse };
});

const supabaseMock = { isAuthenticated: false };
vi.mock("@/lib/supabase/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return {
    updateSupabaseSession: async () => ({
      response: NextResponse.next(),
      isAuthenticated: supabaseMock.isAuthenticated,
    }),
  };
});

import { proxy } from "./proxy";

function makeRequest(pathname: string, base = "https://example.com") {
  const url = new URL(`${base}${pathname}`);
  return {
    url: url.toString(),
    nextUrl: Object.assign(url, { clone: () => new URL(url.toString()) }),
    cookies: { getAll: () => [], set: () => {} },
  } as unknown as import("next/server").NextRequest;
}

afterEach(() => {
  supabaseMock.isAuthenticated = false;
});

describe("proxy() - security headers (always applied)", () => {
  it("sets HSTS, content-type-options, frame-options, referrer-policy", async () => {
    supabaseMock.isAuthenticated = true;
    const res = (await proxy(makeRequest("/dashboard"))) as unknown as {
      headers: Map<string, string>;
    };
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("CSP allows supabase.co for connect-src", async () => {
    supabaseMock.isAuthenticated = true;
    const res = (await proxy(makeRequest("/"))) as unknown as { headers: Map<string, string> };
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe("proxy() - route guards", () => {
  it("allows unauthenticated access to / (marketing landing)", async () => {
    const res = (await proxy(makeRequest("/"))) as unknown as { status: number };
    expect(res.status).toBe(200);
  });

  it("redirects unauthenticated user from /dashboard with redirect param", async () => {
    const res = (await proxy(makeRequest("/dashboard"))) as unknown as {
      status: number;
      headers: Map<string, string>;
    };
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?redirect=%2Fdashboard");
  });

  it("allows unauthenticated access to /login", async () => {
    const res = (await proxy(makeRequest("/login"))) as unknown as { status: number };
    expect(res.status).toBe(200);
  });

  it("allows unauthenticated access to /auth/callback", async () => {
    const res = (await proxy(makeRequest("/auth/callback?code=abc"))) as unknown as {
      status: number;
    };
    expect(res.status).toBe(200);
  });

  it("redirects authenticated user away from /login to /dashboard", async () => {
    supabaseMock.isAuthenticated = true;
    const res = (await proxy(makeRequest("/login"))) as unknown as {
      status: number;
      headers: Map<string, string>;
    };
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/dashboard$/);
  });

  it("authenticated user can access /dashboard", async () => {
    supabaseMock.isAuthenticated = true;
    const res = (await proxy(makeRequest("/dashboard"))) as unknown as { status: number };
    expect(res.status).toBe(200);
  });
});
