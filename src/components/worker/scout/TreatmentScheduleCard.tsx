"use client";

import { useState } from "react";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import {
  FlaskConical,
  Calendar,
  MapPin,
  Package,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { vibrateTap } from "@/lib/haptics";
import { TreatmentComplianceForm } from "./TreatmentComplianceForm";
import type { IpmTask, ComplianceData } from "@/app/actions/ipm-tasks";
import { completeTasks } from "@/app/actions/ipm-tasks";
import { toast } from "sonner";

interface TreatmentScheduleCardProps {
  task: IpmTask;
  onUpdate?: () => void;
  compact?: boolean;
}

/**
 * Card displaying a scheduled treatment with action to record completion.
 */
export function TreatmentScheduleCard({
  task,
  onUpdate,
  compact = false,
}: TreatmentScheduleCardProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQuickCompleting, setIsQuickCompleting] = useState(false);

  const scheduledDate = parseISO(task.scheduledDate);
  const isOverdue = task.status === "overdue" || (task.status === "pending" && isPast(scheduledDate) && !isToday(scheduledDate));
  const isDueToday = isToday(scheduledDate);
  const isDueTomorrow = isTomorrow(scheduledDate);

  const getDateLabel = () => {
    if (isDueToday) return "Today";
    if (isDueTomorrow) return "Tomorrow";
    if (isOverdue) return `Overdue (${format(scheduledDate, "MMM d")})`;
    return format(scheduledDate, "MMM d");
  };

  const getStatusBadge = () => {
    if (task.status === "completed") {
      return <Badge variant="outline" className="text-green-600 border-green-600">Completed</Badge>;
    }
    if (task.status === "skipped") {
      return <Badge variant="outline" className="text-gray-500">Skipped</Badge>;
    }
    if (isOverdue) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (isDueToday) {
      return <Badge className="bg-amber-500">Due Today</Badge>;
    }
    return <Badge variant="secondary">Scheduled</Badge>;
  };

  const handleComplete = async (taskIds: string[], data: ComplianceData) => {
    try {
      const result = await completeTasks(taskIds, data);
      if (!result.success) {
        throw new Error(result.error);
      }
      toast.success("Treatment recorded", {
        description: data.bottleId ? `${data.quantityUsedMl}ml recorded` : undefined,
      });
      onUpdate?.();
    } catch (error) {
      toast.error("Failed to record treatment");
      throw error;
    }
  };

  const handleQuickComplete = async () => {
    vibrateTap();
    setIsQuickCompleting(true);
    try {
      await handleComplete([task.id], {});
    } finally {
      setIsQuickCompleting(false);
    }
  };

  const handleOpenForm = () => {
    vibrateTap();
    setIsFormOpen(true);
  };

  if (compact) {
    return (
      <>
        <div
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border",
            "cursor-pointer active:bg-muted/50 transition-all",
            "touch-manipulation",
            task.status === "completed" && "opacity-60"
          )}
          onClick={task.status !== "completed" ? handleOpenForm : undefined}
        >
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              isOverdue
                ? "bg-red-100 text-red-600"
                : isDueToday
                ? "bg-amber-100 text-amber-600"
                : task.status === "completed"
                ? "bg-green-100 text-green-600"
                : "bg-blue-100 text-blue-600"
            )}
          >
            {task.status === "completed" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : isOverdue ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <FlaskConical className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{task.productName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {task.location?.name || task.batch?.batchNumber}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={cn(
              "text-xs font-medium",
              isOverdue && "text-red-600",
              isDueToday && "text-amber-600"
            )}>
              {getDateLabel()}
            </p>
          </div>
          {task.status !== "completed" && (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
        </div>

        <TreatmentComplianceForm
          task={task}
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onComplete={handleComplete}
        />
      </>
    );
  }

  return (
    <>
      <Card className={cn(
        task.status === "completed" && "opacity-60",
        isOverdue && "border-red-200 dark:border-red-900"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                isOverdue
                  ? "bg-red-100 text-red-600"
                  : isDueToday
                  ? "bg-amber-100 text-amber-600"
                  : task.status === "completed"
                  ? "bg-green-100 text-green-600"
                  : "bg-blue-100 text-blue-600"
              )}
            >
              {task.status === "completed" ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : isOverdue ? (
                <AlertTriangle className="h-6 w-6" />
              ) : (
                <FlaskConical className="h-6 w-6" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{task.productName}</h3>
                  {task.rate && (
                    <p className="text-sm text-muted-foreground">
                      {task.rate} {task.rateUnit} - {task.method}
                    </p>
                  )}
                </div>
                {getStatusBadge()}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span className={cn(
                    isOverdue && "text-red-600 font-medium",
                    isDueToday && "text-amber-600 font-medium"
                  )}>
                    {getDateLabel()}
                  </span>
                </div>

                {task.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{task.location.name}</span>
                  </div>
                )}

                {task.batch && (
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    <span className="font-mono text-xs">{task.batch.batchNumber}</span>
                  </div>
                )}
              </div>

              {task.notes && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {task.notes}
                </p>
              )}

              {task.status !== "completed" && task.status !== "skipped" && (
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-h-[44px]"
                    onClick={handleQuickComplete}
                    disabled={isQuickCompleting}
                  >
                    {isQuickCompleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Quick Done
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 min-h-[44px]"
                    onClick={handleOpenForm}
                  >
                    Record Details
                  </Button>
                </div>
              )}

              {task.status === "completed" && task.completedAt && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Completed {format(parseISO(task.completedAt), "MMM d 'at' h:mm a")}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <TreatmentComplianceForm
        task={task}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onComplete={handleComplete}
      />
    </>
  );
}

export default TreatmentScheduleCard;
