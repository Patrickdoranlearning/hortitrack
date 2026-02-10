import { NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { supabaseAdmin } from "@/server/db/supabaseAdmin";
import { logger } from "@/server/utils/logger";

export async function POST() {
  try {
    const supabase = await getSupabaseServerApp();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get the org info from user metadata (set during invite)
    const defaultOrgId = user.user_metadata?.default_org_id;
    const defaultOrgRole = user.user_metadata?.default_org_role || "viewer";

    if (!defaultOrgId) {
      // No org specified in invite - try to find the default org
      const { data: orgs } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1);

      if (!orgs || orgs.length === 0) {
        return NextResponse.json(
          { error: "No organization found" },
          { status: 400 }
        );
      }

      // Use the first org as fallback
      const fallbackOrgId = orgs[0].id;
      
      // Create profile and membership with fallback org
      await createProfileAndMembership(user.id, user.email, fallbackOrgId, "viewer");
      
      return NextResponse.json({ success: true, orgId: fallbackOrgId });
    }

    // Create profile and membership with the invited org
    await createProfileAndMembership(user.id, user.email, defaultOrgId, defaultOrgRole);

    return NextResponse.json({ success: true, orgId: defaultOrgId });
  } catch (error) {
    logger.auth.error("Complete onboarding failed", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}

async function createProfileAndMembership(
  userId: string,
  email: string | undefined,
  orgId: string,
  role: string
) {
  // Create or update profile
  const displayName = email ? email.split("@")[0] : "User";
  
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: userId,
        display_name: displayName,
        email: email ?? null,
        active_org_id: orgId,
      },
      { onConflict: "id" }
    );

  if (profileError) {
    logger.auth.error("Profile upsert failed during onboarding", profileError, { userId });
    throw profileError;
  }

  // Create org membership
  const { error: membershipError } = await supabaseAdmin
    .from("org_memberships")
    .upsert(
      {
        org_id: orgId,
        user_id: userId,
        role: role,
      },
      { onConflict: "org_id,user_id" }
    );

  if (membershipError) {
    logger.auth.error("Membership upsert failed during onboarding", membershipError, { userId, orgId });
    throw membershipError;
  }
}

