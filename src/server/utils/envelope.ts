import { NextResponse } from "next/server";
export function ok<T>(data: T, init?: number | ResponseInit) {
  const respInit = typeof init === "number" ? { status: init } : (init ?? {});
  return NextResponse.json({ ok: true, data }, respInit);
}
export function fail(status: number, code: string, message: string, fields?: any) {
  return NextResponse.json({ ok: false, error: { code, message, fields } }, { status });
}
