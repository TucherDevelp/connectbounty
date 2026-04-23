/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { getSupabaseBrowserClient } from "./client";

describe("getSupabaseBrowserClient", () => {
  it("instantiates without throwing and is a singleton", () => {
    const a = getSupabaseBrowserClient();
    const b = getSupabaseBrowserClient();
    expect(a).toBe(b);
    expect(a.auth).toBeDefined();
    expect(typeof a.from).toBe("function");
  });
});
