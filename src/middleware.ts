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
  const ACTIVE_ORG_COOKIE = "active_org_id";

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

  // 2. Supabase Session Refresh + Org resolution
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string; options?: Record<string, unknown> }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session (auth cookie rotation)
  const { data: { user } = { user: null } } = await supabase.auth.getUser();

  const activeOrgFromCookie = request.cookies.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  let activeOrgId: string | null = activeOrgFromCookie ?? null;

  if (!activeOrgId && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_org_id")
      .eq("id", user.id)
      .single();

    if (profile?.active_org_id) {
      activeOrgId = profile.active_org_id;
    } else {
      const { data: membership } = await supabase
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (membership?.org_id) {
        activeOrgId = membership.org_id;
      }
    }
  }

  if (!user && activeOrgFromCookie) {
    response.cookies.delete(ACTIVE_ORG_COOKIE);
  } else if (activeOrgId && activeOrgId !== activeOrgFromCookie) {
    response.cookies.set(ACTIVE_ORG_COOKIE, activeOrgId, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }

  return response;
}
