"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ClipboardList, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/worker/TaskCard";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  WorkerTask,
  TaskStats,
  GroupedTasks,
} from "@/lib/types/worker-tasks";
import { groupTasksByStatus } from "@/lib/types/worker-tasks";
import { cn } from "@/lib/utils";

export default function WorkerHomePage() {
  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [stats, setStats] = useState<TaskStats>({ pending: 0, inProgress: 0, completedToday: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch("/api/worker/my-tasks");

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch tasks");
      }

      const data = await response.json();
      setTasks(data.tasks);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleRefresh = () => {
    fetchTasks(true);
  };

  const grouped: GroupedTasks = groupTasksByStatus(tasks);
  const hasActiveTasks = grouped.inProgress.length > 0 || grouped.assigned.length > 0 || grouped.pending.length > 0;

  return (
    <div className="px-4 py-4 space-y-6">
      {/* Stats Summary */}
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

      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Tasks</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="min-h-[44px] min-w-[44px]"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Loading State */}
      {loading && !refreshing && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchTasks()} variant="outline">
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
            You have no tasks assigned for today. Check back later or contact your supervisor.
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
      "rounded-lg p-3 text-center",
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
