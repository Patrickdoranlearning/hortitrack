import { z } from "zod";
import { mapError } from "@/lib/validation"; // or "../validation" if colocated
import { ZodError } from "zod";

describe("mapError", () => {
  it("returns 401 for Unauthorized error", () => {
    const result = mapError({ code: "UNAUTHORIZED", message: "nope" });
    expect(result).toEqual({ status: 401, body: { error: "Unauthorized" } });
  });

  it("returns 400 for ZodError (constructed)", () => {
    const err = new ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "number",
        path: ["name"],
        message: "Expected string, received number",
      },
    ]);
    const result = mapError(err);
    expect(result.status).toBe(400);
    expect(Array.isArray(result.body.issues)).toBe(true);
  });

  it("returns 400 for ZodError (from parse failure)", () => {
    const Schema = z.object({ name: z.string() });
    let caught: unknown;
    try {
      Schema.parse({ name: 123 });
    } catch (e) {
      caught = e;
    }
    const result = mapError(caught);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe("Bad Request");
    expect(result.body.issues[0].path).toEqual(["name"]);
  });

  it("returns 500 for other errors with generic message (security)", () => {
    const result = mapError(new Error("boom"));
    // Should NOT expose internal error messages for security
    expect(result).toEqual({ status: 500, body: { error: "Internal Error" } });
  });

  it("returns 500 for undefined/null with generic message", () => {
    // @ts-expect-error testing robustness
    expect(mapError(undefined)).toEqual({ status: 500, body: { error: "Internal Error" } });
    // @ts-expect-error testing robustness
    expect(mapError(null)).toEqual({ status: 500, body: { error: "Internal Error" } });
  });

  it("returns 500 for non-UNAUTHORIZED codes", () => {
    const result = mapError({ code: "SOMETHING_ELSE" });
    expect(result.status).toBe(500);
  });
});