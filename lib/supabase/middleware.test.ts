import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => {
  class CookieJar {
    private store = new Map<string, string>();
    getAll() {
      return Array.from(this.store, ([name, value]) => ({ name, value }));
    }
    set(name: string, value: string) {
      this.store.set(name, value);
    }
  }
  class StubResponse {
    headers = new Map<string, string>();
    cookies = new CookieJar();
  }
  return {
    NextResponse: { next: () => new StubResponse() },
  };
});

import { updateSupabaseSession } from "./middleware";

function makeRequest() {
  const cookies = new Map<string, string>();
  return {
    url: "https://example.com/",
    nextUrl: new URL("https://example.com/"),
    cookies: {
      getAll: () => Array.from(cookies, ([name, value]) => ({ name, value })),
      set: (name: string, value: string) => cookies.set(name, value),
    },
  } as unknown as import("next/server").NextRequest;
}

describe("updateSupabaseSession", () => {
  it("returns response + isAuthenticated=false when no session cookie", async () => {
    const result = await updateSupabaseSession(makeRequest());
    expect(result.response).toBeDefined();
    expect(result.isAuthenticated).toBe(false);
  });
});
