import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  // Core security headers
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "no-referrer");
  // Allow camera on this origin; keep mic/geo disabled by default
  // You can append additional origins via NEXT_CAMERA_ALLOWED_ORIGINS (space-separated), but it's optional.
  const extra = (process.env.NEXT_CAMERA_ALLOWED_ORIGINS ?? "").trim(); // e.g. "https://your-preview.vercel.app"
  const allowList = ["self", ...extra.split(/\s+/).filter(Boolean)]
    .map(v => (v === "self" ? "self" : `"${v}"`))
    .join(" ");
  res.headers.set("Permissions-Policy", `camera=(${allowList}), microphone=(), geolocation=()`);

  // CSP (opt-in via env to avoid breaking dev)
  if (process.env.NEXT_ENABLE_CSP === "1") {
    const csp = [
      "default-src 'self'",
      "img-src 'self' https: data:",
      "font-src 'self' https: data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "connect-src 'self' https:",
    ].join("; ");
    res.headers.set("Content-Security-Policy", csp);
  }
  
  // Basic CSRF/Origin check for state-changing requests
  if (["POST","PATCH","PUT","DELETE"].includes(req.method)) {
    const origin = req.headers.get("origin") ?? "";
    const host = req.headers.get("host") ?? "";
    const allowed = [ `https://${host}`, `http://${host}` ];
    const extra = (process.env.NEXT_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);
    if (origin && ![...allowed, ...extra].some(a => origin.startsWith(a))) {
      return NextResponse.json({ error: "Bad Origin" }, { status: 403 });
    }
  }
  return res;
}

export const config = { matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"] };
