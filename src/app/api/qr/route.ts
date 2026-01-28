import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import bwip from "bwip-js";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Auth Check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  }

  // Rate limit: 60 QR codes per minute per user
  const rlKey = `qr:generate:${requestKey(req, user.id)}`;
  const rl = await checkRateLimit({ key: rlKey, windowMs: 60_000, max: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests", resetMs: rl.resetMs },
      { status: 429 }
    );
  }

  const value = req.nextUrl.searchParams.get("value") ?? req.nextUrl.searchParams.get("t") ?? "";
  const type = (req.nextUrl.searchParams.get("type") ?? "qr").toLowerCase(); // 'qr' | 'datamatrix'
  const format = (req.nextUrl.searchParams.get("format") ?? "png").toLowerCase(); // 'png' | 'svg'

  if (!value) return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Missing value" } }, { status: 400 });

  try {
    if (type === "datamatrix") {
      if (format === "svg") {
        const svg = bwip.toSVG({ bcid: "datamatrix", text: value, scale: 3, includetext: false, padding: 0 });
        return new NextResponse(svg as any, { status: 200, headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=31536000, immutable" } });
      }
      const png = await bwip.toBuffer({ bcid: "datamatrix", text: value, scale: 3, includetext: false, padding: 0 });
      return new NextResponse(png, { status: 200, headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
    }

    // QR code
    if (format === "svg") {
      const svg = await QRCode.toString(value, { type: "svg", margin: 1, scale: 6 });
      return new NextResponse(svg, { status: 200, headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=31536000, immutable" } });
    }
    const png = await QRCode.toBuffer(value, { type: "png", margin: 1, scale: 6 });
    return new NextResponse(png, { status: 200, headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: { code: "RENDER_FAIL", message: e?.message ?? "Failed to render code" } }, { status: 500 });
  }
}
