import { NextResponse } from "next/server";
import { getAllPickerTasks } from "@/server/dispatch/picker-queries";
import { logError } from "@/lib/log";

/**
 * GET /api/worker/picking
 * Get the current user's picking queue (my tasks + available tasks)
 */
export async function GET() {
  try {
    const { myTasks, availableTasks } = await getAllPickerTasks();

    return NextResponse.json({
      myTasks,
      availableTasks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch picking queue";

    if (message === "Unauthenticated") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 }
      );
    }

    logError("Error fetching worker picking queue", { error: message });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
