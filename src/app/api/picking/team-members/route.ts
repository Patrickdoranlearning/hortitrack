import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabaseServerApp";
import { getUserAndOrg } from "@/server/auth/org";
import { logger, getErrorMessage } from "@/server/utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgMemberRow {
  user_id: string;
  role: string;
  profile: {
    id: string;
    full_name: string | null;
    display_name: string | null;
    email: string | null;
  } | null;
}

interface TeamMember {
  id: string;
  fullName: string | null;
  displayName: string | null;
  email: string | null;
  role: string;
}

// ---------------------------------------------------------------------------
// GET /api/picking/team-members
// Returns org members who could be assigned as pickers.
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const { data, error } = await supabase
      .from("org_memberships")
      .select(
        `
        user_id,
        role,
        profile:profiles(id, full_name, display_name, email)
      `
      )
      .eq("org_id", orgId);

    if (error) {
      logger.picking.error("Error fetching team members", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const members: TeamMember[] = (data ?? []).map((row: OrgMemberRow) => ({
      id: row.user_id,
      fullName: row.profile?.full_name ?? null,
      displayName: row.profile?.display_name ?? null,
      email: row.profile?.email ?? null,
      role: row.role,
    }));

    return NextResponse.json({ members });
  } catch (error) {
    logger.picking.error("Team members GET failed", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
