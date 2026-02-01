import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import type { TeamMember, CompletedTask, TeamActivityResponse } from "@/types/worker";

/**
 * Worker Team Activity API
 *
 * Returns team activity for the current day.
 * Shows who is working on what (in_progress tasks) and recently completed tasks.
 * Does NOT expose private data like email or phone.
 */

export async function GET(_req: NextRequest) {
  try {
    const { supabase, orgId, user } = await getUserAndOrg();
    const userId = user.id;

    // Get today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Fetch all org users (team members) - only name, no private data
    const { data: orgUsers, error: usersError } = await supabase
      .from("org_users")
      .select(`
        user_id,
        users!inner (
          id,
          first_name,
          last_name
        )
      `)
      .eq("org_id", orgId);

    if (usersError) {
      console.error("[api/worker/team] Users error:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch team members" },
        { status: 500 }
      );
    }

    // Build user map for name lookups - Supabase returns users as array with !inner
    const userMap = new Map<string, { name: string; initials: string }>();
    for (const row of (orgUsers ?? [])) {
      // Handle both single object and array formats from Supabase
      const usersData = row.users as { id: string; first_name: string | null; last_name: string | null } | { id: string; first_name: string | null; last_name: string | null }[];
      const user = Array.isArray(usersData) ? usersData[0] : usersData;
      if (!user) continue;
      const firstName = user.first_name || "";
      const lastName = user.last_name || "";
      const name = `${firstName} ${lastName}`.trim() || "Unknown User";
      const initials = (
        (firstName[0] || "") + (lastName[0] || "")
      ).toUpperCase() || "?";
      userMap.set(row.user_id, { name, initials });
    }

    // Fetch in_progress tasks for "Right Now" section
    const { data: inProgressTasks, error: ipError } = await supabase
      .from("task_assignments")
      .select(`
        user_id,
        started_at,
        task:tasks!inner (
          id,
          title,
          status
        )
      `)
      .eq("tasks.org_id", orgId)
      .eq("tasks.status", "in_progress")
      .not("started_at", "is", null);

    if (ipError) {
      console.error("[api/worker/team] In-progress error:", ipError);
    }

    // Build right now list
    const rightNow: TeamMember[] = [];
    const seenUsers = new Set<string>();

    for (const row of (inProgressTasks ?? [])) {
      const rowUserId = row.user_id as string;
      if (seenUsers.has(rowUserId)) continue;
      seenUsers.add(rowUserId);

      const userInfo = userMap.get(rowUserId);
      if (!userInfo) continue;

      // Handle task as single object or array
      const taskData = row.task as { id: string; title: string; status: string } | { id: string; title: string; status: string }[];
      const task = Array.isArray(taskData) ? taskData[0] : taskData;
      if (!task) continue;

      const startedAtStr = row.started_at as string | null;
      const startedAt = startedAtStr ? new Date(startedAtStr) : new Date();
      const durationMinutes = Math.floor(
        (Date.now() - startedAt.getTime()) / (1000 * 60)
      );

      rightNow.push({
        id: rowUserId,
        name: userInfo.name,
        avatarInitials: userInfo.initials,
        currentTask: {
          id: task.id,
          title: task.title,
          startedAt: startedAtStr || new Date().toISOString(),
          durationMinutes,
        },
      });
    }

    // Fetch completed tasks today
    const { data: completedTasks, error: ctError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        completed_at,
        task_assignments!inner (
          user_id
        )
      `)
      .eq("org_id", orgId)
      .eq("status", "completed")
      .gte("completed_at", todayStart.toISOString())
      .lte("completed_at", todayEnd.toISOString())
      .order("completed_at", { ascending: false })
      .limit(20);

    if (ctError) {
      console.error("[api/worker/team] Completed error:", ctError);
    }

    // Build completed today list
    const completedToday: CompletedTask[] = [];
    for (const row of (completedTasks ?? [])) {
      const assignments = row.task_assignments as { user_id: string }[];
      const assignment = assignments?.[0];
      if (!assignment) continue;

      const userInfo = userMap.get(assignment.user_id);
      if (!userInfo) continue;

      completedToday.push({
        id: row.id as string,
        title: row.title as string,
        completedBy: assignment.user_id,
        completedByName: userInfo.name,
        completedAt: (row.completed_at as string | null) || new Date().toISOString(),
      });
    }

    // Calculate stats
    const myCompletedCount = completedToday.filter(
      (t) => t.completedBy === userId
    ).length;

    // Team average (exclude current user)
    const otherUserCompletions = new Map<string, number>();
    for (const task of completedToday) {
      if (task.completedBy === userId) continue;
      const count = otherUserCompletions.get(task.completedBy) || 0;
      otherUserCompletions.set(task.completedBy, count + 1);
    }
    const teamCounts = Array.from(otherUserCompletions.values());
    const teamAverage =
      teamCounts.length > 0
        ? Math.round(teamCounts.reduce((a, b) => a + b, 0) / teamCounts.length)
        : 0;

    const response: TeamActivityResponse = {
      rightNow,
      completedToday,
      myStats: {
        completedToday: myCompletedCount,
        teamAverage,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[api/worker/team] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "An error occurred while fetching team activity" },
      { status: 500 }
    );
  }
}
