import { redirect } from "next/navigation";
import { getAllPickerTasks } from "@/server/dispatch/picker-queries";
import { PickerTaskList } from "@/components/dispatch/picker/PickerTaskCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scan, Clock, CheckCircle, ListTodo } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PickerPage() {
  let tasks;

  try {
    tasks = await getAllPickerTasks();
  } catch (error: any) {
    if (error.message === "Unauthenticated") {
      redirect("/login?next=/dispatch/picker");
    }
    console.error("Error fetching picker tasks:", error);
    tasks = { myTasks: [], availableTasks: [] };
  }

  const { myTasks, availableTasks } = tasks;
  
  // Split my tasks into in-progress and pending
  const inProgressTasks = myTasks.filter((t) => t.status === "in_progress");
  const assignedPendingTasks = myTasks.filter((t) => t.status === "pending");
  
  const totalMyTasks = myTasks.length;
  const totalAvailable = availableTasks.length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Picking Queue</h1>
          <p className="text-muted-foreground text-sm">
            {totalMyTasks === 0 && totalAvailable === 0
              ? "No orders to pick"
              : totalMyTasks > 0
                ? `${totalMyTasks} assigned to you`
                : `${totalAvailable} available to pick`}
          </p>
        </div>

        <Link href="/dispatch/picker/scan">
          <Button variant="outline" className="gap-2">
            <Scan className="h-4 w-4" />
            <span className="hidden sm:inline">Scan to Pick</span>
          </Button>
        </Link>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-blue-700 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-lg font-bold">{inProgressTasks.length}</span>
          </div>
          <p className="text-xs text-blue-600">In Progress</p>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-primary mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-lg font-bold">{assignedPendingTasks.length}</span>
          </div>
          <p className="text-xs text-muted-foreground">Assigned</p>
        </div>
        <div className="bg-muted/50 border border-border rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
            <ListTodo className="h-4 w-4" />
            <span className="text-lg font-bold">{totalAvailable}</span>
          </div>
          <p className="text-xs text-muted-foreground">Available</p>
        </div>
      </div>

      {/* In Progress Section - Most prominent */}
      {inProgressTasks.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold text-lg">Continue Picking</h2>
            <Badge variant="default" className="bg-blue-500">{inProgressTasks.length}</Badge>
          </div>
          <PickerTaskList
            tasks={inProgressTasks}
            emptyMessage=""
            variant="in_progress"
          />
        </div>
      )}

      {/* Assigned to Me Section */}
      {assignedPendingTasks.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold text-lg">Assigned to Me</h2>
            <Badge variant="secondary">{assignedPendingTasks.length}</Badge>
          </div>
          <PickerTaskList
            tasks={assignedPendingTasks}
            emptyMessage=""
            variant="assigned"
          />
        </div>
      )}

      {/* Available Orders Section */}
      {availableTasks.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold text-lg text-muted-foreground">Available Orders</h2>
            <Badge variant="outline">{availableTasks.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Pick up any order below if you&apos;re ready for more work
          </p>
          <PickerTaskList
            tasks={availableTasks}
            emptyMessage=""
            variant="available"
          />
        </div>
      )}

      {/* Empty state when nothing to do */}
      {totalMyTasks === 0 && totalAvailable === 0 && (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            There are no orders waiting to be picked right now.
            Check back soon or scan a trolley label to start.
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
