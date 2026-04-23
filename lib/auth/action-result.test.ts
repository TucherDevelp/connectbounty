import { describe, expect, it } from "vitest";
import {
  actionError,
  actionOk,
  fieldErrorsFromZod,
  idleAction,
} from "./action-result";

describe("action-result", () => {
  it("idle is the default state", () => {
    expect(idleAction).toEqual({ status: "idle" });
  });

  it("actionOk wraps message", () => {
    expect(actionOk("yo")).toEqual({ status: "ok", message: "yo" });
    expect(actionOk()).toEqual({ status: "ok" });
  });

  it("actionError supports field errors", () => {
    const e = actionError("bad", { email: "x" });
    expect(e).toEqual({ status: "error", message: "bad", fieldErrors: { email: "x" } });
  });

  it("fieldErrorsFromZod flattens issues", () => {
    const out = fieldErrorsFromZod([
      { path: ["email"], message: "bad email" },
      { path: ["password"], message: "weak" },
      { path: [], message: "_root" },
    ]);
    expect(out).toEqual({ email: "bad email", password: "weak", _: "_root" });
  });

  it("fieldErrorsFromZod last issue per field wins", () => {
    const out = fieldErrorsFromZod([
      { path: ["email"], message: "first" },
      { path: ["email"], message: "second" },
    ]);
    expect(out.email).toBe("second");
  });
});
