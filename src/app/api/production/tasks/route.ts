import { NextResponse } from "next/server";
import { getProductionTasks, groupTasksByWeek, type TasksFilter } from "@/server/production/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    
    const filter: TasksFilter = {};
    
    // Parse query params
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const status = url.searchParams.get("status");
    const varietyId = url.searchParams.get("varietyId");
    const groupByWeek = url.searchParams.get("groupByWeek") === "true";

    if (startDate) filter.startDate = startDate;
    if (endDate) filter.endDate = endDate;
    if (status === "Planned" || status === "Incoming" || status === "all") {
      filter.status = status;
    }
    if (varietyId) filter.varietyId = varietyId;

    const tasks = await getProductionTasks(filter);

    if (groupByWeek) {
      const grouped = groupTasksByWeek(tasks);
      // Convert Map to object for JSON serialization
      const weekGroups: Record<string, typeof tasks> = {};
      grouped.forEach((weekTasks, weekKey) => {
        weekGroups[weekKey] = weekTasks;
      });
      
      return NextResponse.json({
        tasks,
        weekGroups,
        totalCount: tasks.length,
      });
    }

    return NextResponse.json({
      tasks,
      totalCount: tasks.length,
    });
  } catch (error: unknown) {
    console.error("[api/production/tasks] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const status = /unauthenticated/i.test(errorMessage) ? 401 : 500;
    return NextResponse.json(
      { error: errorMessage || "Failed to fetch production tasks" },
      { status }
    );
  }
}

