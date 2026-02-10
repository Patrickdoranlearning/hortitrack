"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isToday, isTomorrow, isPast, startOfDay, getISOWeek } from "date-fns";
import {
  Package,
  Calendar,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/dispatch/shared/StatusPill";
import { toast } from "@/lib/toast";
import type { PickerTask } from "@/lib/dispatch/types";

type TaskVariant = "in_progress" | "assigned" | "available";

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
  // Within 3 days
  const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 3) {
    return { level: "soon", color: "text-amber-600", bgColor: "" };
  }
  return { level: "normal", color: "text-muted-foreground", bgColor: "" };
}

interface PickerTaskCardProps {
  task: PickerTask;
  variant?: TaskVariant;
}

export function PickerTaskCard({ task, variant = "assigned" }: PickerTaskCardProps) {
  const router = useRouter();
  const [isCreatingPickList, setIsCreatingPickList] = useState(false);
  
  const progressPercent =
    task.totalItems > 0
      ? Math.round((task.pickedItems / task.totalItems) * 100)
      : 0;

  const isInProgress = task.status === "in_progress";
  const hasFeedback = task.unacknowledgedFeedbackCount > 0;
  const urgency = getUrgency(task.requestedDeliveryDate);
  const weekNumber = task.requestedDeliveryDate 
    ? getISOWeek(parseISO(task.requestedDeliveryDate))
    : null;
  
  // Check if this is an order without a pick list (ID starts with "order-")
  const needsPickListCreation = task.id.startsWith("order-");
  const actualPickListId = needsPickListCreation ? null : task.id;

  const handleStartPicking = async () => {
    // Already assigned to this user — navigate directly
    if (!needsPickListCreation && actualPickListId && variant !== "available") {
      router.push(`/dispatch/picking/${actualPickListId}/workflow`);
      return;
    }

    // Available task or needs pick list creation — assign to current user first
    setIsCreatingPickList(true);
    try {
      const res = await fetch("/api/dispatch/assign-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: task.orderId }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to create pick list");
      }

      const pickListId = data.pickListId || actualPickListId;
      router.push(`/dispatch/picking/${pickListId}/workflow`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to start picking";
      toast.error(message);
      setIsCreatingPickList(false);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md",
        isInProgress && "ring-2 ring-blue-500/50 bg-blue-50/30",
        hasFeedback && "border-orange-300 bg-orange-50/50",
        variant === "available" && "border-dashed",
        urgency.bgColor && !isInProgress && urgency.bgColor
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Order info */}
          <div className="flex-1 min-w-0">
            {/* Customer name and badges */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-base truncate">
                {task.customerName}
              </h3>
              {hasFeedback && (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  QC Issue
                </Badge>
              )}
            </div>

            {/* Order details row */}
            <div className="flex items-center gap-2 flex-wrap text-sm mb-3">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                {task.orderNumber}
              </span>
              
              {task.requestedDeliveryDate && (
                <>
                  <span className={cn("flex items-center gap-1", urgency.color)}>
                    {urgency.level === "overdue" && <AlertTriangle className="h-3.5 w-3.5" />}
                    {urgency.level === "today" && <AlertTriangle className="h-3.5 w-3.5" />}
                    <Calendar className="h-3.5 w-3.5" />
                    {urgency.level === "overdue" && "Overdue: "}
                    {urgency.level === "today" && "Today"}
                    {urgency.level === "tomorrow" && "Tomorrow"}
                    {urgency.level !== "today" && urgency.level !== "tomorrow" && urgency.level !== "overdue" && 
                      format(parseISO(task.requestedDeliveryDate), "EEE, MMM d")
                    }
                    {urgency.level === "overdue" && format(parseISO(task.requestedDeliveryDate), "MMM d")}
                  </span>
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    W{weekNumber}
                  </Badge>
                </>
              )}
            </div>

            {/* Order Items */}
            {task.items && task.items.length > 0 && (
              <div className="mb-3 p-2 bg-muted/50 rounded-md">
                <div className="space-y-1">
                  {task.items.slice(0, 3).map((item, idx) => (
                    <div key={item.id || idx} className="flex items-center justify-between text-xs">
                      <span className="truncate flex-1 mr-2">
                        {item.varietyName || item.description}
                        {item.sizeName && <span className="text-muted-foreground ml-1">({item.sizeName})</span>}
                      </span>
                      <span className="font-medium text-muted-foreground whitespace-nowrap">
                        x{item.quantity}
                      </span>
                    </div>
                  ))}
                  {task.items.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{task.items.length - 3} more item{task.items.length - 3 > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            )}

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

            {/* Status row */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <StatusPill status={task.status} size="sm" />
              {task.isPartial && (
                <Badge variant="outline" className="text-xs">
                  Split Pick
                </Badge>
              )}
              {task.qcStatus && (
                <StatusPill status={`qc_${task.qcStatus}`} size="sm" />
              )}
              {variant === "available" && !needsPickListCreation && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Unassigned
                </Badge>
              )}
              {needsPickListCreation && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                  New Order
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
                "gap-1",
                isInProgress && "bg-blue-600 hover:bg-blue-700"
              )}
              onClick={handleStartPicking}
              disabled={isCreatingPickList}
            >
              {isCreatingPickList ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
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

interface PickerTaskListProps {
  tasks: PickerTask[];
  title?: string;
  emptyMessage?: string;
  variant?: TaskVariant;
}

export function PickerTaskList({
  tasks,
  title,
  emptyMessage = "No tasks assigned",
  variant = "assigned",
}: PickerTaskListProps) {
  if (tasks.length === 0 && emptyMessage) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {title && (
        <h2 className="font-semibold text-lg flex items-center gap-2">
          {title}
          <Badge variant="secondary">{tasks.length}</Badge>
        </h2>
      )}
      {tasks.map((task) => (
        <PickerTaskCard key={task.id} task={task} variant={variant} />
      ))}
    </div>
  );
}
