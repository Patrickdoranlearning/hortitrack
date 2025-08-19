import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get("t") ?? "";
  if (!text) return NextResponse.json({ error: "Missing t" }, { status: 400 });
  const png = await QRCode.toBuffer(text, { type: "png", margin: 1, scale: 6 });
  return new NextResponse(png, { status: 200, headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
}
