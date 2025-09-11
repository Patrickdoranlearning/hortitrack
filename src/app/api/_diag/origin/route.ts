import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAllowedOrigin } from "@/lib/security/origin";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    ok: true,
    allowed: isAllowedOrigin(req),
    method: req.method,
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    secFetchSite: req.headers.get("sec-fetch-site"),
    nextAction: req.headers.get("next-action"),
    nodeEnv: process.env.NODE_ENV,
  });
}
