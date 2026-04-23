import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Supabase + Next-Helpers mocken, bevor actions importiert wird.
const supabaseAuth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => Promise.resolve({ auth: supabaseAuth }),
}));

const redirectMock = vi.fn((_url: string) => {
  throw new Error("__NEXT_REDIRECT__");
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { idleAction } from "./action-result";
import {
  loginAction,
  registerAction,
  requestPasswordResetAction,
  updatePasswordAction,
} from "./actions";

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.set(k, v);
  return form;
}

beforeEach(() => {
  for (const fn of Object.values(supabaseAuth)) fn.mockReset();
  redirectMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── loginAction ────────────────────────────────────────────────────────────

describe("loginAction", () => {
  it("returns field errors for invalid email", async () => {
    const res = await loginAction(idleAction, fd({ email: "x", password: "y" }));
    expect(res.status).toBe("error");
    if (res.status === "error") {
      expect(res.fieldErrors?.email).toMatch(/E-Mail/);
    }
    expect(supabaseAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns generic error when supabase rejects", async () => {
    supabaseAuth.signInWithPassword.mockResolvedValueOnce({ error: new Error("no") });
    const res = await loginAction(idleAction, fd({ email: "a@b.de", password: "x" }));
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.message).toMatch(/nicht korrekt/);
    expect(res.status === "error" ? res.fieldErrors : null).toBeUndefined();
  });

  it("redirects to / on success", async () => {
    supabaseAuth.signInWithPassword.mockResolvedValueOnce({ error: null });
    await expect(
      loginAction(idleAction, fd({ email: "a@b.de", password: "x" })),
    ).rejects.toThrow("__NEXT_REDIRECT__");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});

// ── registerAction ────────────────────────────────────────────────────────

describe("registerAction", () => {
  const valid = {
    email: "a@b.de",
    password: "Sicher12345!",
    confirmPassword: "Sicher12345!",
    displayName: "Olli",
    terms: "on",
  };

  it("returns field errors for weak password", async () => {
    const res = await registerAction(
      idleAction,
      fd({ ...valid, password: "schwach", confirmPassword: "schwach" }),
    );
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.fieldErrors?.password).toBeDefined();
  });

  it("calls supabase.signUp with redirect URL and displayName", async () => {
    supabaseAuth.signUp.mockResolvedValueOnce({ error: null });
    const res = await registerAction(idleAction, fd(valid));
    expect(supabaseAuth.signUp).toHaveBeenCalledWith({
      email: "a@b.de",
      password: "Sicher12345!",
      options: {
        emailRedirectTo: expect.stringMatching(/\/auth\/callback$/),
        data: { display_name: "Olli" },
      },
    });
    expect(res.status).toBe("ok");
  });

  it("returns generic error when supabase fails", async () => {
    supabaseAuth.signUp.mockResolvedValueOnce({ error: new Error("nope") });
    const res = await registerAction(idleAction, fd(valid));
    expect(res.status).toBe("error");
  });
});

// ── requestPasswordResetAction ────────────────────────────────────────────

describe("requestPasswordResetAction", () => {
  it("returns success even when supabase errors (no enumeration)", async () => {
    supabaseAuth.resetPasswordForEmail.mockResolvedValueOnce({ error: new Error("not found") });
    const res = await requestPasswordResetAction(idleAction, fd({ email: "a@b.de" }));
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(res.message).toMatch(/Falls die Adresse/);
  });

  it("rejects invalid email", async () => {
    const res = await requestPasswordResetAction(idleAction, fd({ email: "" }));
    expect(res.status).toBe("error");
    expect(supabaseAuth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

// ── updatePasswordAction ──────────────────────────────────────────────────

describe("updatePasswordAction", () => {
  const valid = { password: "NeuesPW9999!", confirmPassword: "NeuesPW9999!" };

  it("rejects when no active session", async () => {
    supabaseAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await updatePasswordAction(idleAction, fd(valid));
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.message).toMatch(/Reset-Link/);
    expect(supabaseAuth.updateUser).not.toHaveBeenCalled();
  });

  it("calls updateUser with new password and returns success", async () => {
    supabaseAuth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    supabaseAuth.updateUser.mockResolvedValueOnce({ error: null });
    const res = await updatePasswordAction(idleAction, fd(valid));
    expect(supabaseAuth.updateUser).toHaveBeenCalledWith({ password: "NeuesPW9999!" });
    expect(res.status).toBe("ok");
  });

  it("rejects mismatched passwords without calling supabase", async () => {
    const res = await updatePasswordAction(
      idleAction,
      fd({ password: "NeuesPW9999!", confirmPassword: "Anderswert99!" }),
    );
    expect(res.status).toBe("error");
    expect(supabaseAuth.getUser).not.toHaveBeenCalled();
  });
});
