import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrgAdmin } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const { user, orgId, supabase } = await getUserAndOrgAdmin();

    // Check if requester is admin or owner
    const { data: requesterMembership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { role, fullName } = body;

    // Handle name update
    if (fullName !== undefined) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", targetUserId);

      if (profileError) {
        logger.api.error("Failed to update member name", profileError, { targetUserId });
        return NextResponse.json({ error: "Failed to update member name" }, { status: 500 });
      }

      // If only updating name (no role change), return success
      if (role === undefined) {
        return NextResponse.json({ success: true });
      }
    }

    // Handle role update
    if (role !== undefined) {
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
          .eq("user_id", targetUserId)
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
        .eq("user_id", targetUserId);

      if (error) {
        logger.api.error("Failed to update member role", error, { targetUserId });
        return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.api.error("PATCH /api/org/members/[userId] failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const { user, orgId, supabase } = await getUserAndOrgAdmin();

    // Check if requester is admin or owner
    // supabase from getUserAndOrgAdmin bypasses RLS for admin operations
    const { data: requesterMembership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if target user is the last owner
    const { data: targetMembership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
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
      .eq("user_id", targetUserId);

    if (error) {
      logger.api.error("Failed to remove org member", error, { targetUserId });
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.api.error("DELETE /api/org/members/[userId] failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
