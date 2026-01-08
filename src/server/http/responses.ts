import { NextResponse } from "next/server";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiError<D = unknown> = {
  ok: false;
  error: string;
  details?: D;
};

type StatusInit = number | ResponseInit | undefined;
type ErrorInit = number | (ResponseInit & { details?: unknown }) | undefined;

function resolveInit(init?: StatusInit): ResponseInit | undefined {
  if (typeof init === "number") return { status: init };
  return init;
}

export function jsonSuccess<T>(data: T, init?: StatusInit) {
  const payload: ApiSuccess<T> = { ok: true, data };
  return NextResponse.json(payload, resolveInit(init));
}

export function jsonError(message: string, init?: ErrorInit) {
  if (typeof init === "number") {
    return NextResponse.json({ ok: false, error: message }, { status: init });
  }
  const { details, ...rest } = init ?? {};
  const payload: ApiError = { ok: false, error: message };
  if (typeof details !== "undefined") {
    payload.details = details;
  }
  return NextResponse.json(payload, rest);
}

