import { NextRequest, NextResponse } from "next/server";
import { getUserIdAndOrgId } from "@/server/auth/getUser";
import { getSupabaseServerApp } from "@/server/db/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: requesterId, orgId } = await getUserIdAndOrgId();

    if (!requesterId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getSupabaseServerApp();

    // Check if requester is admin or owner
    const { data: requesterMembership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", requesterId)
      .single();

    if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { role } = body;

    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    // Validate role
    const validRoles = ["owner", "admin", "grower", "sales", "viewer"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if target user is the last owner
    if (role !== "owner") {
      const { data: targetMembership } = await supabase
        .from("org_memberships")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", params.userId)
        .single();

      if (targetMembership?.role === "owner") {
        // Count owners in the org
        const { count } = await supabase
          .from("org_memberships")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("role", "owner");

        if (count && count <= 1) {
          return NextResponse.json(
            { error: "Cannot demote the last owner of the organization" },
            { status: 400 }
          );
        }
      }
    }

    // Update the role
    const { error } = await supabase
      .from("org_memberships")
      .update({ role })
      .eq("org_id", orgId)
      .eq("user_id", params.userId);

    if (error) {
      console.error("Error updating member role:", error);
      return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PATCH /api/org/members/[userId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: requesterId, orgId } = await getUserIdAndOrgId();

    if (!requesterId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getSupabaseServerApp();

    // Check if requester is admin or owner
    const { data: requesterMembership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", requesterId)
      .single();

    if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if target user is the last owner
    const { data: targetMembership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", params.userId)
      .single();

    if (targetMembership?.role === "owner") {
      // Count owners in the org
      const { count } = await supabase
        .from("org_memberships")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("role", "owner");

      if (count && count <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner of the organization" },
          { status: 400 }
        );
      }
    }

    // Remove the member
    const { error } = await supabase
      .from("org_memberships")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", params.userId);

    if (error) {
      console.error("Error removing member:", error);
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/org/members/[userId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
