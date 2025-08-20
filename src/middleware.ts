import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAllowedOrigin } from "@/lib/security/origin";

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const { pathname } = url;

  // Always allow Next internal & static assets
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Allow CORS preflight
  if (req.method === "OPTIONS") return NextResponse.next();

  // Next.js Server Actions (private wire)
  // Next adds "Next-Action: 1" for these requests.
  const nextAction = (req.headers.get("next-action") || "").trim();
  if (nextAction === "1") return NextResponse.next();

  // If the browser says same-origin or same-site, allow.
  const sfs = (req.headers.get("sec-fetch-site") || "").toLowerCase();
  if (sfs === "same-origin" || sfs === "same-site") return NextResponse.next();

  // Fallback to configured origin policy
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ ok: false, error: "Bad Origin (middleware)" }, { status: 403 });
  }

  return NextResponse.next();
}

// Only run on real app routes (skip _next and static)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)",
  ],
};
