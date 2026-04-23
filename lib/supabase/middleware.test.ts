import { describe, expect, it, vi } from "vitest";

// next/server-Stub mit echtem set/getAll-Verhalten für Cookies.
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
  it("returns a response object even when no session cookie is present", async () => {
    const res = await updateSupabaseSession(makeRequest());
    expect(res).toBeDefined();
    expect(res.headers).toBeInstanceOf(Map);
  });
});
