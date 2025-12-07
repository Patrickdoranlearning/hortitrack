import { NextRequest, NextResponse } from "next/server";
import { getUserIdAndOrgId } from "@/server/auth/getUser";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { supabaseAdmin } from "@/server/db/supabaseAdmin";

export async function GET() {
  try {
    const { userId, orgId } = await getUserIdAndOrgId();

    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getSupabaseServerApp();

    // Check if user is admin or owner
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all members of the organization
    const { data: memberships, error: membershipsError } = await supabase
      .from("org_memberships")
      .select("user_id, role, created_at, profiles(id, full_name, email)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (membershipsError) {
      // Check for the specific schema cache error and provide a user-friendly message
      if (membershipsError.code === "PGRST200") {
        console.error("Schema cache error fetching members:", membershipsError);
        return NextResponse.json(
          {
            error:
              "Database schema might be out of sync. Please try again in a few moments.",
          },
          { status: 500 }
        );
      }
      console.error("Error fetching members:", membershipsError);
      return NextResponse.json(
        { error: "Failed to fetch members" },
        { status: 500 }
      );
    }

    return NextResponse.json({ members: memberships || [] });
  } catch (error) {
    console.error("Error in GET /api/org/members:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await getUserIdAndOrgId();

    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getSupabaseServerApp();

    // Check if user is admin or owner
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    // Validate role
    const validRoles = ["owner", "admin", "grower", "sales", "viewer"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Get organization name for the invite email
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    // Invite user via Supabase Auth Admin API
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        default_org_id: orgId,
        default_org_role: role,
        org_name: org?.name || "HortiTrack",
      },
      redirectTo: `${siteUrl}/api/auth/callback?type=invite`,
    });

    if (error) {
      console.error("Error inviting user:", error);
      return NextResponse.json(
        { error: error.message || "Failed to invite user" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
      user: data.user,
    });
  } catch (error) {
    console.error("Error in POST /api/org/members:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
