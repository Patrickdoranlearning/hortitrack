import { NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/server/utils/logger";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const type = searchParams.get("type"); // 'invite', 'recovery', 'magiclink', etc.

  if (code) {
    const supabase = await getSupabaseServerApp();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    // Log auth errors to Sentry for monitoring
    if (error) {
      Sentry.captureException(error, {
        tags: { component: "auth-callback", type: type ?? "unknown" },
        extra: { hasCode: !!code, next },
      });
      logger.auth.error("Code exchange failed in auth callback", error);
    }

    if (!error && data.user) {
      // Check if this is an invite flow - user needs to set password
      // Invite links have type=invite, or we can check if user has default_org_id metadata
      const isInvite = type === "invite" || type === "recovery";
      const hasOrgMetadata = !!data.user.user_metadata?.default_org_id;
      
      // Check if user is new (created recently and first login)
      const createdAt = new Date(data.user.created_at).getTime();
      const now = Date.now();
      const isNewUser = now - createdAt < 5 * 60 * 1000; // Created within last 5 minutes

      // If this looks like an invite, redirect to password setup
      if ((isInvite || hasOrgMetadata) && isNewUser) {
        return NextResponse.redirect(`${origin}/auth/set-password`);
      }

      // Normal login - redirect to intended destination
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Log when no code is provided (potential issue with OAuth flow)
  if (!code) {
    Sentry.captureMessage("Auth callback called without code", {
      level: "warning",
      tags: { component: "auth-callback" },
      extra: { type, next },
    });
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}
