"use client";

import * as React from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MapPin,
  Leaf,
  ChevronRight,
  Beaker,
  FlaskConical,
  SkipForward,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type IpmTask = {
  id: string;
  batchId: string;
  productId: string;
  productName: string;
  method?: string;
  rate?: number;
  rateUnit?: string;
  scheduledWeek: number;
  weekStartDate: string;
  status: "pending" | "completed" | "skipped" | "overdue";
  batch?: {
    batchNumber?: string;
    variety?: string;
  };
  location?: {
    id: string;
    name: string;
  };
  product?: {
    pcsNumber?: string;
    whiDays?: number;
  };
};

type TaskGroup = {
  productId: string;
  productName: string;
  isTankMix: boolean;
  tankMixProducts?: string[];
  method?: string;
  rate?: number;
  rateUnit?: string;
  calendarWeek: number;
  weekStartDate: string;
  locations: { id: string; name: string; batchCount: number }[];
  totalBatches: number;
  tasks: IpmTask[];
};

type KanbanColumn = {
  id: "pending" | "overdue" | "completed" | "skipped";
  title: string;
  description: string;
  color: string;
  icon: React.ElementType;
};

const COLUMNS: KanbanColumn[] = [
  {
    id: "pending",
    title: "Pending",
    description: "Tasks due this week and upcoming",
    color: "bg-blue-50 dark:bg-blue-950/30",
    icon: Clock,
  },
  {
    id: "overdue",
    title: "Overdue",
    description: "Tasks past their scheduled date",
    color: "bg-amber-50 dark:bg-amber-950/30",
    icon: AlertTriangle,
  },
  {
    id: "completed",
    title: "Completed",
    description: "Finished tasks",
    color: "bg-green-50 dark:bg-green-950/30",
    icon: CheckCircle2,
  },
  {
    id: "skipped",
    title: "Skipped",
    description: "Tasks that were skipped",
    color: "bg-slate-100 dark:bg-slate-900",
    icon: SkipForward,
  },
];

type Props = {
  taskGroups: TaskGroup[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onGroupClick?: (group: TaskGroup) => void;
};

export function PlantHealthKanban({
  taskGroups,
  isLoading = false,
  onRefresh,
  onGroupClick,
}: Props) {
  // Group tasks by status
  const groupsByStatus = React.useMemo(() => {
    const grouped: Record<string, TaskGroup[]> = {
      pending: [],
      overdue: [],
      completed: [],
      skipped: [],
    };

    for (const group of taskGroups) {
      // Determine group status based on tasks
      const statuses = group.tasks.map((t) => t.status);
      let groupStatus: string;

      if (statuses.every((s) => s === "completed")) {
        groupStatus = "completed";
      } else if (statuses.every((s) => s === "skipped")) {
        groupStatus = "skipped";
      } else if (statuses.some((s) => s === "overdue")) {
        groupStatus = "overdue";
      } else {
        groupStatus = "pending";
      }

      if (grouped[groupStatus]) {
        grouped[groupStatus].push(group);
      }
    }

    // Sort by week within each status
    for (const status of Object.keys(grouped)) {
      grouped[status].sort((a, b) => {
        const dateA = new Date(a.weekStartDate).getTime();
        const dateB = new Date(b.weekStartDate).getTime();
        return dateA - dateB;
      });
    }

    return grouped;
  }, [taskGroups]);

  // Calculate stats
  const stats = React.useMemo(() => {
    return {
      pending: groupsByStatus.pending?.length ?? 0,
      overdue: groupsByStatus.overdue?.length ?? 0,
      completed: groupsByStatus.completed?.length ?? 0,
      skipped: groupsByStatus.skipped?.length ?? 0,
    };
  }, [groupsByStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {stats.pending} pending
        </span>
        <span className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          {stats.overdue} overdue
        </span>
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          {stats.completed} completed
        </span>
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh} className="ml-auto">
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <div
            key={column.id}
            className={cn(
              "flex-shrink-0 w-80 rounded-lg p-3",
              column.color
            )}
          >
            {/* Column Header */}
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <column.icon className="h-4 w-4" />
                  <h3 className="font-semibold">{column.title}</h3>
                </div>
                <Badge variant="secondary">{groupsByStatus[column.id]?.length ?? 0}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{column.description}</p>
            </div>

            {/* Task Groups */}
            <div className="space-y-3">
              {(groupsByStatus[column.id]?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                  No tasks
                </div>
              ) : (
                groupsByStatus[column.id]?.map((group, idx) => (
                  <TaskGroupCard
                    key={`${group.productId}-${group.calendarWeek}-${idx}`}
                    group={group}
                    onClick={() => onGroupClick?.(group)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Task Group Card Component
function TaskGroupCard({
  group,
  onClick,
}: {
  group: TaskGroup;
  onClick?: () => void;
}) {
  const getWeekLabel = (calendarWeek: number, weekStartDate: string) => {
    const today = new Date();
    const weekStart = new Date(weekStartDate);
    const diffDays = Math.floor((weekStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < -7) return `Week ${calendarWeek}`;
    if (diffDays < 0) return `Week ${calendarWeek} (This week)`;
    if (diffDays < 7) return `Week ${calendarWeek} (This week)`;
    if (diffDays < 14) return `Week ${calendarWeek} (Next week)`;
    return `Week ${calendarWeek}`;
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardHeader className="pb-2 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {group.isTankMix ? (
              <Beaker className="h-4 w-4 text-purple-600 shrink-0" />
            ) : (
              <FlaskConical className="h-4 w-4 text-primary shrink-0" />
            )}
            <CardTitle className="text-sm font-medium line-clamp-2">
              {group.isTankMix
                ? group.tankMixProducts?.join(" + ")
                : group.productName}
            </CardTitle>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
        {group.method && (
          <p className="text-xs text-muted-foreground">
            {group.method}
            {group.rate && ` @ ${group.rate} ${group.rateUnit}`}
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {/* Week */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {getWeekLabel(group.calendarWeek, group.weekStartDate)}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {group.locations.length} location{group.locations.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Leaf className="h-3 w-3" />
            {group.totalBatches} batch{group.totalBatches !== 1 ? "es" : ""}
          </span>
        </div>

        {/* Location preview */}
        <div className="flex flex-wrap gap-1">
          {group.locations.slice(0, 2).map((loc) => (
            <Badge key={loc.id} variant="secondary" className="text-xs">
              {loc.name} ({loc.batchCount})
            </Badge>
          ))}
          {group.locations.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{group.locations.length - 2} more
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export type { TaskGroup, IpmTask };

