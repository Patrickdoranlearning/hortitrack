"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  ListTodo,
  Package,
  Calendar,
  ChevronRight,
  AlertTriangle,
  Loader2,
  WifiOff,
  ScanLine,
} from "lucide-react";
import { format, parseISO, isToday, isTomorrow, isPast, startOfDay, getISOWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PullToRefresh } from "@/components/worker/PullToRefresh";
import { vibrateSuccess, vibrateTap } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import type { PickerTask } from "@/lib/dispatch/types";

interface PickingStats {
  inProgress: number;
  assigned: number;
  available: number;
}

interface PickingQueueData {
  inProgressTasks: PickerTask[];
  assignedTasks: PickerTask[];
  availableTasks: PickerTask[];
  stats: PickingStats;
}

/**
 * Get urgency level based on delivery date
 */
function getUrgency(deliveryDate: string | undefined): {
  level: "overdue" | "today" | "tomorrow" | "soon" | "normal";
  color: string;
  bgColor: string;
} {
  if (!deliveryDate) {
    return { level: "normal", color: "text-muted-foreground", bgColor: "" };
  }

  const date = startOfDay(parseISO(deliveryDate));
  const today = startOfDay(new Date());

  if (isPast(date) && date < today) {
    return { level: "overdue", color: "text-red-700", bgColor: "bg-red-50" };
  }
  if (isToday(date)) {
    return { level: "today", color: "text-red-600", bgColor: "bg-red-50" };
  }
  if (isTomorrow(date)) {
    return { level: "tomorrow", color: "text-amber-600", bgColor: "bg-amber-50" };
  }
  const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 3) {
    return { level: "soon", color: "text-amber-600", bgColor: "" };
  }
  return { level: "normal", color: "text-muted-foreground", bgColor: "" };
}

type TaskVariant = "in_progress" | "assigned" | "available";

interface PickingTaskCardProps {
  task: PickerTask;
  variant: TaskVariant;
  onStartPicking: (task: PickerTask) => Promise<void>;
  isLoading: boolean;
}

function PickingTaskCard({ task, variant, onStartPicking, isLoading }: PickingTaskCardProps) {
  const progressPercent =
    task.totalItems > 0
      ? Math.round((task.pickedItems / task.totalItems) * 100)
      : 0;

  const isInProgress = task.status === "in_progress";
  const urgency = getUrgency(task.requestedDeliveryDate);
  const weekNumber = task.requestedDeliveryDate
    ? getISOWeek(parseISO(task.requestedDeliveryDate))
    : null;

  const needsPickListCreation = task.id.startsWith("order-");

  return (
    <Card
      className={cn(
        "transition-all active:scale-[0.98]",
        isInProgress && "ring-2 ring-blue-500/50 bg-blue-50/30",
        variant === "available" && "border-dashed",
        urgency.bgColor && !isInProgress && urgency.bgColor
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Order info */}
          <div className="flex-1 min-w-0">
            {/* Customer name */}
            <h3 className="font-semibold text-base truncate mb-1">
              {task.customerName}
            </h3>

            {/* Order details row */}
            <div className="flex items-center gap-2 flex-wrap text-sm mb-3">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                {task.orderNumber}
              </span>

              {task.requestedDeliveryDate && (
                <>
                  <span className={cn("flex items-center gap-1", urgency.color)}>
                    {(urgency.level === "overdue" || urgency.level === "today") && (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    <Calendar className="h-3.5 w-3.5" />
                    {urgency.level === "overdue" && "Overdue: "}
                    {urgency.level === "today" && "Today"}
                    {urgency.level === "tomorrow" && "Tomorrow"}
                    {urgency.level !== "today" &&
                      urgency.level !== "tomorrow" &&
                      urgency.level !== "overdue" &&
                      format(parseISO(task.requestedDeliveryDate), "EEE, MMM d")}
                    {urgency.level === "overdue" &&
                      format(parseISO(task.requestedDeliveryDate), "MMM d")}
                  </span>
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    W{weekNumber}
                  </Badge>
                </>
              )}
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {task.pickedItems} of {task.totalItems} items
                </span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress
                value={progressPercent}
                className={cn(
                  "h-2",
                  isInProgress && "[&>div]:bg-blue-500"
                )}
              />
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {needsPickListCreation && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                  New Order
                </Badge>
              )}
              {variant === "available" && !needsPickListCreation && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Unassigned
                </Badge>
              )}
            </div>
          </div>

          {/* Right: Action button */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant={isInProgress ? "default" : variant === "available" ? "outline" : "secondary"}
              className={cn(
                "gap-1 min-h-[44px] min-w-[80px]",
                isInProgress && "bg-blue-600 hover:bg-blue-700"
              )}
              onClick={() => onStartPicking(task)}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="sr-only">Loading</span>
                </>
              ) : isInProgress ? (
                <>
                  <Clock className="h-4 w-4" />
                  Continue
                </>
              ) : variant === "available" ? (
                <>
                  Pick Up
                  <ChevronRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Start
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>

            {/* Units count */}
            <span className="text-xs text-muted-foreground">
              {task.pickedQty || 0} / {task.totalQty || 0} units
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TaskSectionProps {
  title: string;
  tasks: PickerTask[];
  variant: TaskVariant;
  onStartPicking: (task: PickerTask) => Promise<void>;
  loadingTaskId: string | null;
  defaultCollapsed?: boolean;
}

function TaskSection({
  title,
  tasks,
  variant,
  onStartPicking,
  loadingTaskId,
  defaultCollapsed = false,
}: TaskSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  if (tasks.length === 0) return null;

  return (
    <section className="space-y-3">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between py-2 touch-manipulation"
      >
        <h2 className="font-semibold text-lg flex items-center gap-2">
          {title}
          <Badge variant="secondary">{tasks.length}</Badge>
        </h2>
        <ChevronRight
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform",
            !isCollapsed && "rotate-90"
          )}
        />
      </button>

      {!isCollapsed && (
        <div className="space-y-3">
          {tasks.map((task) => (
            <PickingTaskCard
              key={task.id}
              task={task}
              variant={variant}
              onStartPicking={onStartPicking}
              isLoading={loadingTaskId === task.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function DispatchLandingPage() {
  const router = useRouter();
  const [data, setData] = useState<PickingQueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Track online status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch picking queue data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/worker/picking");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch picking queue");
      }
      const result = await res.json();

      const inProgressTasks = result.myTasks?.filter(
        (t: PickerTask) => t.status === "in_progress"
      ) || [];
      const assignedTasks = result.myTasks?.filter(
        (t: PickerTask) => t.status === "pending"
      ) || [];
      const availableTasks = result.availableTasks || [];

      setData({
        inProgressTasks,
        assignedTasks,
        availableTasks,
        stats: {
          inProgress: inProgressTasks.length,
          assigned: assignedTasks.length,
          available: availableTasks.length,
        },
      });
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load picking queue";
      setError(message);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    load();
  }, [fetchData]);

  // Handle refresh
  const handleRefresh = async () => {
    vibrateTap();
    setRefreshing(true);
    try {
      await fetchData();
      vibrateSuccess();
    } finally {
      setRefreshing(false);
    }
  };

  // Handle pull-to-refresh
  const handlePullRefresh = async () => {
    vibrateTap();
    await fetchData();
    vibrateSuccess();
  };

  // Handle starting a picking task
  const handleStartPicking = async (task: PickerTask) => {
    vibrateTap();
    setLoadingTaskId(task.id);

    try {
      const needsPickListCreation = task.id.startsWith("order-");
      let pickListId = needsPickListCreation ? null : task.id;

      if (needsPickListCreation) {
        // Create pick list first
        const res = await fetch("/api/dispatch/assign-picker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: task.orderId }),
        });

        const result = await res.json();
        if (!result.ok) {
          throw new Error(result.error || "Failed to create pick list");
        }
        pickListId = result.pickListId;
      }

      vibrateSuccess();
      router.push(`/worker/picking/${pickListId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start picking";
      setError(message);
      setLoadingTaskId(null);
    }
  };

  const handleScanOrder = () => {
    vibrateTap();
    router.push("/worker/scan");
  };

  const hasAnyTasks =
    data &&
    (data.inProgressTasks.length > 0 ||
      data.assignedTasks.length > 0 ||
      data.availableTasks.length > 0);

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
            <span>You are offline. Pull down to refresh when connected.</span>
          </div>
        )}

        {/* Quick Action: Scan Order */}
        <Card
          className={cn(
            "bg-primary text-primary-foreground cursor-pointer",
            "transition-all active:scale-[0.98]",
            "touch-manipulation"
          )}
          onClick={handleScanOrder}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <ScanLine className="h-6 w-6" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold">Scan Order</h2>
              <p className="text-sm opacity-90">Scan an order or pick list</p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        {data && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-blue-700 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-lg font-bold">{data.stats.inProgress}</span>
              </div>
              <p className="text-xs text-blue-600">In Progress</p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-primary mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-lg font-bold">{data.stats.assigned}</span>
              </div>
              <p className="text-xs text-muted-foreground">Assigned</p>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <ListTodo className="h-4 w-4" />
                <span className="text-lg font-bold">{data.stats.available}</span>
              </div>
              <p className="text-xs text-muted-foreground">Available</p>
            </div>
          </div>
        )}

        {/* Header with Refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Picking Queue</h1>
            {data && (
              <p className="text-muted-foreground text-sm">
                {!hasAnyTasks
                  ? "No orders to pick"
                  : data.stats.inProgress + data.stats.assigned > 0
                    ? `${data.stats.inProgress + data.stats.assigned} assigned to you`
                    : `${data.stats.available} available to pick`}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || !isOnline}
            className="min-h-[44px] min-w-[44px]"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline" disabled={!isOnline}>
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && data && !hasAnyTasks && (
          <div className="text-center py-16 border rounded-lg bg-muted/20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              There are no orders waiting to be picked right now.
              Check back soon or ask your supervisor.
            </p>
          </div>
        )}

        {/* Task Sections */}
        {!loading && !error && data && hasAnyTasks && (
          <div className="space-y-6">
            {/* In Progress */}
            <TaskSection
              title="Continue Picking"
              tasks={data.inProgressTasks}
              variant="in_progress"
              onStartPicking={handleStartPicking}
              loadingTaskId={loadingTaskId}
            />

            {/* Assigned to Me */}
            <TaskSection
              title="Assigned to Me"
              tasks={data.assignedTasks}
              variant="assigned"
              onStartPicking={handleStartPicking}
              loadingTaskId={loadingTaskId}
            />

            {/* Available Orders */}
            <TaskSection
              title="Available Orders"
              tasks={data.availableTasks}
              variant="available"
              onStartPicking={handleStartPicking}
              loadingTaskId={loadingTaskId}
              defaultCollapsed={data.inProgressTasks.length > 0 || data.assignedTasks.length > 0}
            />
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
