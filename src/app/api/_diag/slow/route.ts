import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET(req: Request) {
  // Disable diagnostic endpoints in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const ms = Number(url.searchParams.get("ms") || "0");
  await new Promise(r => setTimeout(r, ms));
  return NextResponse.json({ ok: true, waitedMs: ms });
}
