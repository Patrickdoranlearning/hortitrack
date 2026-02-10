import { NextResponse } from "next/server";

// ── Types ────────────────────────────────────────────────────────────────────

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiError<D = unknown> = {
  ok: false;
  error: { code: string; message: string; fields?: unknown };
  details?: D;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function ok<T>(data: T, init?: number | ResponseInit) {
  const ri = typeof init === "number" ? { status: init } : (init ?? {});
  return NextResponse.json({ ok: true, data }, ri);
}

export function fail(status: number, code: string, message: string, fields?: unknown) {
  return NextResponse.json({ ok: false, error: { code, message, fields } }, { status });
}

/**
 * Shorthand for fail() when you only need a status + message (no error code).
 * Used by withApiGuard and middleware.
 */
type ErrorInit = number | (ResponseInit & { details?: unknown });
export function jsonError(message: string, init?: ErrorInit) {
  if (typeof init === "number") {
    return NextResponse.json({ ok: false, error: { code: "ERROR", message } }, { status: init });
  }
  const { details, ...rest } = init ?? {};
  return NextResponse.json(
    { ok: false, error: { code: "ERROR", message }, ...(details !== undefined ? { details } : {}) },
    rest,
  );
}
