import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetEnvCacheForTests, clientEnv, serverEnv } from "./env";

const ORIG = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIG };
  __resetEnvCacheForTests();
});

afterEach(() => {
  process.env = { ...ORIG };
  __resetEnvCacheForTests();
});

describe("env validation", () => {
  it("clientEnv parses a valid configuration", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "x".repeat(50);
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

    const env = clientEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("clientEnv applies default for NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "x".repeat(50);
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(clientEnv().NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("clientEnv throws helpful error when supabase URL missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "x".repeat(50);

    expect(() => clientEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("serverEnv throws when SUPABASE_SERVICE_ROLE_KEY missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => serverEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("serverEnv accepts valid service-role key", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "y".repeat(60);
    expect(serverEnv().SUPABASE_SERVICE_ROLE_KEY).toHaveLength(60);
  });
});
