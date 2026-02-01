"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard } from "@/components/worker/TaskCard";
import type { WorkerTask } from "@/lib/types/worker-tasks";

interface DaySectionProps {
  date: string;
  dayName: string;
  isToday: boolean;
  tasks: WorkerTask[];
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  };
  defaultExpanded?: boolean;
  onTaskUpdate?: () => void;
}

/**
 * Collapsible day section showing tasks and stats
 */
export function DaySection({
  date,
  dayName: _dayName,
  isToday,
  tasks,
  stats,
  defaultExpanded = false,
  onTaskUpdate,
}: DaySectionProps) {
  // dayName is passed for context but we use formattedDate for display
  void _dayName;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || isToday);

  // Format date for display (e.g., "Mon, Jan 27")
  const formattedDate = new Date(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Calculate task count label
  const taskCountLabel = stats.total === 1 ? "1 task" : `${stats.total} tasks`;

  // Determine status indicator
  const allCompleted = stats.total > 0 && stats.completed === stats.total;
  const hasInProgress = stats.inProgress > 0;
  const hasPending = stats.pending > 0;

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden",
        isToday && "ring-2 ring-primary ring-offset-2"
      )}
    >
      {/* Header - tappable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between p-4 text-left",
          "hover:bg-muted/50 transition-colors",
          "min-h-[56px]",
          isExpanded && "border-b"
        )}
        aria-expanded={isExpanded}
        aria-controls={`day-content-${date}`}
      >
        <div className="flex items-center gap-3">
          {/* Expand/collapse icon */}
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          )}

          {/* Date and today badge */}
          <div className="flex items-center gap-2">
            <span className="font-medium">{formattedDate}</span>
            {isToday && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                Today
              </span>
            )}
          </div>
        </div>

        {/* Right side: status and count */}
        <div className="flex items-center gap-3">
          {/* Status icon */}
          {stats.total > 0 && (
            <div className="flex items-center gap-1">
              {allCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : hasInProgress ? (
                <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
              ) : hasPending ? (
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              ) : null}
            </div>
          )}

          {/* Task count badge */}
          <span
            className={cn(
              "text-sm px-2 py-1 rounded-full",
              stats.total === 0
                ? "text-muted-foreground"
                : allCompleted
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-muted text-foreground"
            )}
          >
            {taskCountLabel}
          </span>
        </div>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div
          id={`day-content-${date}`}
          className="p-4 space-y-3 bg-muted/20"
        >
          {stats.total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tasks scheduled
            </p>
          ) : (
            <>
              {/* Progress summary if any completed */}
              {stats.completed > 0 && stats.completed < stats.total && (
                <div className="text-sm text-muted-foreground mb-2">
                  {stats.completed} of {stats.total} completed
                </div>
              )}

              {/* Task cards */}
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUpdate={onTaskUpdate}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
