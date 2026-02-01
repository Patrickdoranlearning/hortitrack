import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import type { TeamMemberDetail } from "@/types/worker";

/**
 * Worker Team Member Detail API
 *
 * Returns activity details for a specific team member.
 * Only shows work-related data, NOT private info (email, phone).
 */

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { userId: targetUserId } = await context.params;

    // Validate UUID format
    const parseResult = z.string().uuid().safeParse(targetUserId);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid user ID format" },
        { status: 400 }
      );
    }

    const { supabase, orgId } = await getUserAndOrg();

    // Verify target user belongs to same org
    const { data: orgUser, error: orgUserError } = await supabase
      .from("org_users")
      .select(`
        user_id,
        users!inner (
          id,
          first_name,
          last_name
        )
      `)
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .single();

    if (orgUserError || !orgUser) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    // Extract user info (no private data) - handle single or array format from Supabase
    const usersData = orgUser.users as { id: string; first_name: string | null; last_name: string | null } | { id: string; first_name: string | null; last_name: string | null }[];
    const userInfo = Array.isArray(usersData) ? usersData[0] : usersData;
    if (!userInfo) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }
    const firstName = userInfo.first_name || "";
    const lastName = userInfo.last_name || "";
    const name = `${firstName} ${lastName}`.trim() || "Unknown User";
    const initials =
      ((firstName[0] || "") + (lastName[0] || "")).toUpperCase() || "?";

    // Get today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get current task (in_progress)
    const { data: currentTasks } = await supabase
      .from("task_assignments")
      .select(`
        started_at,
        task:tasks!inner (
          id,
          title,
          status
        )
      `)
      .eq("user_id", targetUserId)
      .eq("tasks.org_id", orgId)
      .eq("tasks.status", "in_progress")
      .limit(1);

    let currentTask: TeamMemberDetail["currentTask"] = null;

    if (currentTasks && currentTasks.length > 0) {
      const row = currentTasks[0];
      // Handle task as single object or array
      const taskData = row.task as { id: string; title: string; status: string } | { id: string; title: string; status: string }[];
      const task = Array.isArray(taskData) ? taskData[0] : taskData;
      const startedAtStr = row.started_at as string | null;

      if (task) {
        const startedAt = startedAtStr ? new Date(startedAtStr) : new Date();
        const durationMinutes = Math.floor(
          (Date.now() - startedAt.getTime()) / (1000 * 60)
        );

        currentTask = {
          id: task.id,
          title: task.title,
          startedAt: startedAtStr || new Date().toISOString(),
          durationMinutes,
        };
      }
    }

    // Count tasks completed today
    const { count: completedCount } = await supabase
      .from("task_assignments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetUserId)
      .eq("tasks.org_id", orgId)
      .eq("tasks.status", "completed")
      .gte("tasks.completed_at", todayStart.toISOString())
      .lte("tasks.completed_at", todayEnd.toISOString());

    // Get recent tasks (completed or in_progress)
    const { data: recentTasks } = await supabase
      .from("task_assignments")
      .select(`
        task:tasks!inner (
          id,
          title,
          status,
          completed_at
        )
      `)
      .eq("user_id", targetUserId)
      .eq("tasks.org_id", orgId)
      .in("tasks.status", ["completed", "in_progress"])
      .order("tasks.completed_at", { ascending: false, nullsFirst: true })
      .limit(10);

    // Map recent tasks - handle task as single object or array
    const mappedRecentTasks: TeamMemberDetail["recentTasks"] = [];
    for (const row of (recentTasks ?? [])) {
      const taskData = row.task as { id: string; title: string; status: string; completed_at: string | null } | { id: string; title: string; status: string; completed_at: string | null }[];
      const task = Array.isArray(taskData) ? taskData[0] : taskData;
      if (task) {
        mappedRecentTasks.push({
          id: task.id,
          title: task.title,
          status: task.status,
          completedAt: task.completed_at,
        });
      }
    }

    const response: TeamMemberDetail = {
      id: targetUserId,
      name,
      avatarInitials: initials,
      currentTask,
      tasksCompletedToday: completedCount || 0,
      recentTasks: mappedRecentTasks,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[api/worker/team/[userId]] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "An error occurred while fetching team member details" },
      { status: 500 }
    );
  }
}
