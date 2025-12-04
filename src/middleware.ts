import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAllowedOrigin } from "@/lib/security/origin";
import { jsonError } from "@/server/http/responses";

// Matcher for paths to apply middleware to
export const config = {
  matcher: [
    "/api/:path*",
    // Add other paths that need origin protection if necessary
  ],
};

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Apply origin checks only to API routes or server actions
  if (pathname.startsWith("/api/")) {
    // Fallback to configured origin policy
    if (!isAllowedOrigin(req)) {
      const details = {
        host: req.headers.get("host"),
        origin: req.headers.get("origin"),
        referer: req.headers.get("referer"),
        sfs: req.headers.get("sec-fetch-site"),
        xfHost: req.headers.get("x-forwarded-host"),
        xfProto: req.headers.get("x-forwarded-proto"),
        path: pathname,
        method: req.method,
      };
      console.warn("[middleware] blocked Bad Origin", details);
      return jsonError("Bad Origin", { status: 403, details });
    }
  }

  return NextResponse.next();
}
