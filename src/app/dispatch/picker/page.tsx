import { redirect } from "next/navigation";
import { getAllPickerTasks } from "@/server/dispatch/picker-queries";
import { PickerTaskList } from "@/components/dispatch/picker/PickerTaskCard";
import { Button } from "@/components/ui/button";
import { Scan } from "lucide-react";
import Link from "next/link";

export default async function PickerPage() {
  let tasks;

  try {
    tasks = await getAllPickerTasks();
  } catch (error: any) {
    if (error.message === "Unauthenticated") {
      redirect("/login?next=/dispatch/picker");
    }
    console.error("Error fetching picker tasks:", error);
    tasks = { myTasks: [], teamTasks: [] };
  }

  const { myTasks, teamTasks } = tasks;
  const totalTasks = myTasks.length + teamTasks.length;
  const inProgressTasks = myTasks.filter((t) => t.status === "in_progress");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Picking Tasks</h1>
          <p className="text-muted-foreground">
            {totalTasks === 0
              ? "No tasks assigned"
              : `${totalTasks} task${totalTasks === 1 ? "" : "s"} to complete`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dispatch/picker/scan">
            <Button variant="outline" className="gap-2">
              <Scan className="h-4 w-4" />
              Scan to Pick
            </Button>
          </Link>
        </div>
      </div>

      {/* In Progress Section */}
      {inProgressTasks.length > 0 && (
        <div className="mb-8">
          <PickerTaskList
            tasks={inProgressTasks}
            title="Continue Picking"
            emptyMessage="No tasks in progress"
          />
        </div>
      )}

      {/* My Assigned Tasks */}
      <div className="mb-8">
        <PickerTaskList
          tasks={myTasks.filter((t) => t.status !== "in_progress")}
          title="Assigned to Me"
          emptyMessage="No tasks assigned to you"
        />
      </div>

      {/* Team Tasks */}
      {teamTasks.length > 0 && (
        <div className="mb-8">
          <PickerTaskList
            tasks={teamTasks}
            title="Team Tasks"
            emptyMessage="No team tasks available"
          />
        </div>
      )}

      {/* Empty state */}
      {totalTasks === 0 && (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Scan className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No picking tasks</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            You don&apos;t have any picking tasks assigned. Scan a trolley
            label to start picking an order, or wait for tasks to be assigned.
          </p>
          <Link href="/dispatch/picker/scan">
            <Button className="gap-2">
              <Scan className="h-4 w-4" />
              Scan Trolley Label
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
