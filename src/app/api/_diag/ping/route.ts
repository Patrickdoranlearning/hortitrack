import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  // Disable diagnostic endpoints in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, now: Date.now() });
}
