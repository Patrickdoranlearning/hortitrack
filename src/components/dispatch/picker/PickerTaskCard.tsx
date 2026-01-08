"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Package,
  Calendar,
  User,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StatusPill, ProgressPill } from "@/components/dispatch/shared/StatusPill";
import type { PickerTask } from "@/lib/dispatch/types";

interface PickerTaskCardProps {
  task: PickerTask;
}

export function PickerTaskCard({ task }: PickerTaskCardProps) {
  const progressPercent =
    task.totalItems > 0
      ? Math.round((task.pickedItems / task.totalItems) * 100)
      : 0;

  const isInProgress = task.status === "in_progress";
  const hasFeedback = task.unacknowledgedFeedbackCount > 0;

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md",
        isInProgress && "ring-2 ring-primary/50",
        hasFeedback && "border-orange-300 bg-orange-50/50"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Order info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
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

            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                {task.orderNumber}
              </span>
              {task.requestedDeliveryDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(parseISO(task.requestedDeliveryDate), "MMM d")}
                </span>
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
              <Progress value={progressPercent} className="h-2" />
            </div>

            {/* Status row */}
            <div className="flex items-center gap-2 mt-3">
              <StatusPill status={task.status} size="sm" />
              {task.isPartial && (
                <Badge variant="outline" className="text-xs">
                  Split Pick
                </Badge>
              )}
              {task.qcStatus && (
                <StatusPill status={`qc_${task.qcStatus}`} size="sm" />
              )}
            </div>
          </div>

          {/* Right: Action button */}
          <div className="flex flex-col items-end gap-2">
            <Link href={`/dispatch/picking/${task.id}/workflow`}>
              <Button
                size="sm"
                variant={isInProgress ? "default" : "outline"}
                className="gap-1"
              >
                {isInProgress ? (
                  <>
                    <Clock className="h-4 w-4" />
                    Continue
                  </>
                ) : (
                  <>
                    Start
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </Link>

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
}

export function PickerTaskList({
  tasks,
  title,
  emptyMessage = "No tasks assigned",
}: PickerTaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
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
        <PickerTaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
