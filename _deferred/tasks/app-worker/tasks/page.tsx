"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RefreshCw, ClipboardList, CheckCircle2, Clock, AlertCircle, WifiOff, ShoppingCart, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskCard } from "@/components/worker/TaskCard";
import { PullToRefresh } from "@/components/worker/PullToRefresh";
import { TaskCardSkeleton, StatCardSkeleton } from "@/components/worker/skeletons";
import { useWorkerTasks } from "@/offline/WorkerOfflineProvider";
import { vibrateSuccess, vibrateTap } from "@/lib/haptics";
import type {
  WorkerTask,
  GroupedTasks,
} from "@/lib/types/worker-tasks";
import { groupTasksByStatus } from "@/lib/types/worker-tasks";
import { cn } from "@/lib/utils";

interface PickingQueueStats {
  inProgress: number;
  assigned: number;
  available: number;
}

export default function WorkerTasksPage() {
  const searchParams = useSearchParams();
  const moduleFilter = searchParams.get("module");

  const { tasks, stats, loading, error, refresh, isOnline } = useWorkerTasks();
  const [refreshing, setRefreshing] = useState(false);
  const [pickingStats, setPickingStats] = useState<PickingQueueStats | null>(null);
  const [pickingLoading, setPickingLoading] = useState(true);

  // Fetch picking queue stats
  useEffect(() => {
    const fetchPickingStats = async () => {
      try {
        const res = await fetch("/api/worker/picking");
        if (res.ok) {
          const data = await res.json();
          const inProgressTasks = data.myTasks?.filter((t: { status: string }) => t.status === "in_progress") || [];
          const assignedTasks = data.myTasks?.filter((t: { status: string }) => t.status === "pending") || [];
          setPickingStats({
            inProgress: inProgressTasks.length,
            assigned: assignedTasks.length,
            available: data.availableTasks?.length || 0,
          });
        }
      } catch {
        // Silent fail - picking queue is optional
      } finally {
        setPickingLoading(false);
      }
    };

    fetchPickingStats();
  }, []);

  // Filter tasks by module if specified
  const filteredTasks = useMemo(() => {
    if (!moduleFilter) return tasks;
    return tasks.filter((t) => t.sourceModule === moduleFilter);
  }, [tasks, moduleFilter]);

  // Group tasks by status
  const grouped: GroupedTasks = useMemo(() => groupTasksByStatus(filteredTasks), [filteredTasks]);
  const hasActiveTasks = grouped.inProgress.length > 0 || grouped.assigned.length > 0 || grouped.pending.length > 0;

  // Handle refresh button click
  const handleRefresh = async () => {
    vibrateTap();
    setRefreshing(true);
    try {
      await refresh();
      vibrateSuccess();
    } finally {
      setRefreshing(false);
    }
  };

  // Handle pull-to-refresh
  const handlePullRefresh = async () => {
    vibrateTap();
    await refresh();
    vibrateSuccess();
  };

  const getModuleLabel = (module: string | null) => {
    switch (module) {
      case "production":
        return "Production";
      case "dispatch":
        return "Dispatch";
      case "plant_health":
        return "Plant Health";
      default:
        return "All";
    }
  };

  return (
    <PullToRefresh
      onRefresh={handlePullRefresh}
      refreshing={refreshing}
      enabled={isOnline}
      className="h-full"
    >
      <div className="px-4 py-4 space-y-6">
        {/* Offline Notice */}
        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm">
            <WifiOff className="h-4 w-4 flex-shrink-0" />
            <span>Showing cached tasks. Pull down to refresh when online.</span>
          </div>
        )}

        {/* Stats Summary */}
        {loading && !refreshing ? (
          <StatCardSkeleton />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={Clock}
              label="Pending"
              value={stats.pending}
              variant="pending"
            />
            <StatCard
              icon={RefreshCw}
              label="In Progress"
              value={stats.inProgress}
              variant="active"
            />
            <StatCard
              icon={CheckCircle2}
              label="Done Today"
              value={stats.completedToday}
              variant="success"
            />
          </div>
        )}

        {/* Picking Queue Card - Show if user has picking tasks */}
        {!pickingLoading && pickingStats && (pickingStats.inProgress > 0 || pickingStats.assigned > 0 || pickingStats.available > 0) && (
          <Link href="/worker/dispatch">
            <Card className="transition-all active:scale-[0.98] hover:shadow-md border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Picking Queue</h3>
                      <p className="text-sm text-muted-foreground">
                        {pickingStats.inProgress > 0 && (
                          <span className="text-blue-600 font-medium">{pickingStats.inProgress} in progress</span>
                        )}
                        {pickingStats.inProgress > 0 && (pickingStats.assigned > 0 || pickingStats.available > 0) && " - "}
                        {pickingStats.assigned > 0 && `${pickingStats.assigned} assigned`}
                        {pickingStats.assigned > 0 && pickingStats.available > 0 && ", "}
                        {pickingStats.available > 0 && `${pickingStats.available} available`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pickingStats.inProgress > 0 && (
                      <Badge className="bg-blue-100 text-blue-700">{pickingStats.inProgress}</Badge>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Header with Refresh */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {moduleFilter ? `${getModuleLabel(moduleFilter)} Tasks` : "My Tasks"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || !isOnline}
            className="min-h-[44px] min-w-[44px]"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {/* Loading State */}
        {loading && !refreshing && (
          <TaskCardSkeleton count={3} />
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline" disabled={!isOnline}>
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && !hasActiveTasks && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Tasks Assigned</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              {moduleFilter
                ? `You have no ${getModuleLabel(moduleFilter).toLowerCase()} tasks assigned.`
                : "You have no tasks assigned for today. Check back later or contact your supervisor."}
            </p>
          </div>
        )}

        {/* Task Lists */}
        {!loading && !error && hasActiveTasks && (
          <div className="space-y-6">
            {/* In Progress - show first */}
            {grouped.inProgress.length > 0 && (
              <TaskSection
                title="In Progress"
                tasks={grouped.inProgress}
                onTaskUpdate={handleRefresh}
              />
            )}

            {/* Assigned */}
            {grouped.assigned.length > 0 && (
              <TaskSection
                title="Assigned"
                tasks={grouped.assigned}
                onTaskUpdate={handleRefresh}
              />
            )}

            {/* Pending (unassigned but visible to worker) */}
            {grouped.pending.length > 0 && (
              <TaskSection
                title="Available"
                tasks={grouped.pending}
                onTaskUpdate={handleRefresh}
              />
            )}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}

interface StatCardProps {
  icon: typeof Clock;
  label: string;
  value: number;
  variant: "pending" | "active" | "success";
}

function StatCard({ icon: Icon, label, value, variant }: StatCardProps) {
  const variantStyles = {
    pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    active: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    success: "bg-green-500/10 text-green-600 dark:text-green-400",
  };

  return (
    <div className={cn(
      "rounded-lg p-3 text-center transition-colors",
      variantStyles[variant]
    )}>
      <Icon className="h-5 w-5 mx-auto mb-1" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

interface TaskSectionProps {
  title: string;
  tasks: WorkerTask[];
  onTaskUpdate: () => void;
}

function TaskSection({ title, tasks, onTaskUpdate }: TaskSectionProps) {
  return (
    <section>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        {title} ({tasks.length})
      </h3>
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onUpdate={onTaskUpdate} />
        ))}
      </div>
    </section>
  );
}
