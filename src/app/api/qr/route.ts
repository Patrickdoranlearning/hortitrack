import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import bwip from "bwip-js";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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
