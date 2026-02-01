"use client";

import * as React from "react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { Clock, Play, CheckCircle, Calendar, Layers, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Task } from "@/server/tasks/service";

type Props = {
  tasks: Task[];
  onStartTask: (task: Task) => void;
  onOpenTask: (task: Task) => void;
};

function formatTaskDate(dateStr: string | null): string {
  if (!dateStr) return "Unscheduled";
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  } catch {
    return dateStr;
  }
}

export function EmployeeSchedule({ tasks, onStartTask, onOpenTask }: Omit<Props, "selectedDate" | "onDateChange">) {
  // Group tasks by date
  const groupedTasks = React.useMemo(() => {
    const groups: Record<string, Task[]> = {
      overdue: [],
      today: [],
      upcoming: [],
    };

    const today = format(new Date(), "yyyy-MM-dd");

    for (const task of tasks) {
      if (!task.scheduledDate) {
        groups.upcoming.push(task);
        continue;
      }

      if (task.scheduledDate < today) {
        groups.overdue.push(task);
      } else if (task.scheduledDate === today) {
        groups.today.push(task);
      } else {
        groups.upcoming.push(task);
      }
    }

    return groups;
  }, [tasks]);

  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");

  return (
    <div className="space-y-6">
      {/* Currently Working On */}
      {inProgressTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Play className="h-4 w-4 text-green-600" />
            Currently Working On
          </h3>
          {inProgressTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="active"
              onStart={onStartTask}
              onOpen={onOpenTask}
            />
          ))}
        </div>
      )}

      {/* Overdue */}
      {groupedTasks.overdue.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-red-600">
            <Clock className="h-4 w-4" />
            Overdue ({groupedTasks.overdue.length})
          </h3>
          {groupedTasks.overdue.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="overdue"
              onStart={onStartTask}
              onOpen={onOpenTask}
            />
          ))}
        </div>
      )}

      {/* Today */}
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Today ({groupedTasks.today.length})
        </h3>
        {groupedTasks.today.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              <CheckCircle className="mx-auto h-8 w-8 mb-2 text-green-500" />
              <p>No tasks scheduled for today</p>
            </CardContent>
          </Card>
        ) : (
          groupedTasks.today.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="today"
              onStart={onStartTask}
              onOpen={onOpenTask}
            />
          ))
        )}
      </div>

      {/* Upcoming */}
      {groupedTasks.upcoming.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-muted-foreground">
            <ChevronRight className="h-4 w-4" />
            Upcoming ({groupedTasks.upcoming.length})
          </h3>
          {groupedTasks.upcoming.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="future"
              onStart={onStartTask}
              onOpen={onOpenTask}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {tasks.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Tasks Assigned</h3>
            <p className="text-muted-foreground">
              You don&apos;t have any tasks assigned yet. Check back later or contact your manager.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type TaskCardProps = {
  task: Task;
  variant: "active" | "overdue" | "today" | "future";
  onStart: (task: Task) => void;
  onOpen: (task: Task) => void;
};

function TaskCard({ task, variant, onStart, onOpen }: TaskCardProps) {
  const isInProgress = task.status === "in_progress";

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        variant === "active" && "border-green-400 bg-green-50/50 dark:bg-green-950/20",
        variant === "overdue" && "border-red-400 bg-red-50/50 dark:bg-red-950/20",
        variant === "today" && "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
        variant === "future" && "opacity-75"
      )}
      onClick={() => onOpen(task)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{task.title}</CardTitle>
            {task.description && (
              <CardDescription className="line-clamp-1">{task.description}</CardDescription>
            )}
          </div>
          <Badge
            variant={
              isInProgress
                ? "default"
                : variant === "overdue"
                ? "destructive"
                : variant === "today"
                ? "secondary"
                : "outline"
            }
          >
            {isInProgress ? "In Progress" : formatTaskDate(task.scheduledDate)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {task.taskType && (
              <span className="capitalize">{task.taskType}</span>
            )}
            {task.plantQuantity && (
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                {task.plantQuantity.toLocaleString()} plants
              </span>
            )}
          </div>
          {!isInProgress && task.status === "assigned" && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onStart(task);
              }}
            >
              <Play className="mr-1.5 h-4 w-4" />
              Start
            </Button>
          )}
          {isInProgress && (
            <Button size="sm" variant="secondary">
              Continue
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

