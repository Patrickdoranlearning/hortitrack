import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAllowedOrigin } from "@/lib/security/origin";
import { jsonError } from "@/server/http/responses";

// Matcher for paths to apply middleware to
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;

  // 1. Security Origin Check (API only)
  if (pathname.startsWith("/api/")) {
    // Fallback to configured origin policy
    if (!isAllowedOrigin(request)) {
      const details = {
        host: request.headers.get("host"),
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
        sfs: request.headers.get("sec-fetch-site"),
        xfHost: request.headers.get("x-forwarded-host"),
        xfProto: request.headers.get("x-forwarded-proto"),
        path: pathname,
        method: request.method,
      };
      console.warn("[middleware] blocked Bad Origin", details);
      return jsonError("Bad Origin", { status: 403, details });
    }
  }

  // 2. Supabase Session Refresh
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This will refresh session if needed
  await supabase.auth.getUser();

  return response;
}
