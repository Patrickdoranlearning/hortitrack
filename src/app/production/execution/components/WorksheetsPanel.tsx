"use client";

import * as React from "react";
import useSWR from "swr";
import { format } from "date-fns";
import {
  FileSpreadsheet,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { WorksheetDetail } from "./WorksheetDetail";
import { fetchJson } from "@/lib/http/fetchJson";
import { cn } from "@/lib/utils";
import type { ExecutionWorksheetWithBatches } from "@/server/production/execution-worksheets";

type WorksheetsResponse = {
  worksheets: ExecutionWorksheetWithBatches[];
};

const worksheetsFetcher = (url: string) =>
  fetchJson<WorksheetsResponse>(url).then((res) => res.worksheets);

type Props = {
  className?: string;
};

export function WorksheetsPanel({ className }: Props) {
  const [showCompleted, setShowCompleted] = React.useState(false);
  const [expandedWorksheetId, setExpandedWorksheetId] = React.useState<string | null>(null);

  const {
    data: worksheets,
    error,
    isLoading,
    mutate: refreshWorksheets,
  } = useSWR("/api/production/execution-worksheets", worksheetsFetcher, {
    refreshInterval: 30000, // Refresh every 30s to catch auto-completions
  });

  const openWorksheets = React.useMemo(
    () => worksheets?.filter((w) => w.status === "open") ?? [],
    [worksheets]
  );

  const completedWorksheets = React.useMemo(
    () => worksheets?.filter((w) => w.status === "completed") ?? [],
    [worksheets]
  );

  const handleWorksheetDeleted = () => {
    refreshWorksheets();
    setExpandedWorksheetId(null);
  };

  const handleToggleExpand = (worksheetId: string) => {
    setExpandedWorksheetId((prev) => (prev === worksheetId ? null : worksheetId));
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5" />
            Saved Worksheets
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5" />
            Saved Worksheets
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load worksheets</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refreshWorksheets()}
            >
              <Loader2 className="mr-1.5 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!worksheets || worksheets.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5" />
            Saved Worksheets
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No saved worksheets yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Select batches and click &ldquo;Create Worksheet&rdquo; to save one
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5" />
            Saved Worksheets
            {openWorksheets.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({openWorksheets.length} open)
              </span>
            )}
          </CardTitle>
          {completedWorksheets.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCompleted(!showCompleted)}
              className="text-xs"
            >
              {showCompleted ? "Hide" : "Show"} completed ({completedWorksheets.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-2">
          {/* Open worksheets */}
          {openWorksheets.map((worksheet) => (
            <WorksheetListItem
              key={worksheet.id}
              worksheet={worksheet}
              isExpanded={expandedWorksheetId === worksheet.id}
              onToggle={() => handleToggleExpand(worksheet.id)}
              onDeleted={handleWorksheetDeleted}
              onRefresh={refreshWorksheets}
            />
          ))}

          {/* Completed worksheets (collapsible) */}
          {showCompleted && completedWorksheets.length > 0 && (
            <div className="pt-2 mt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
                Completed
              </p>
              {completedWorksheets.map((worksheet) => (
                <WorksheetListItem
                  key={worksheet.id}
                  worksheet={worksheet}
                  isExpanded={expandedWorksheetId === worksheet.id}
                  onToggle={() => handleToggleExpand(worksheet.id)}
                  onDeleted={handleWorksheetDeleted}
                  onRefresh={refreshWorksheets}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Worksheet List Item
// ---------------------------------------------------------------------------

type WorksheetListItemProps = {
  worksheet: ExecutionWorksheetWithBatches;
  isExpanded: boolean;
  onToggle: () => void;
  onDeleted: () => void;
  onRefresh: () => void;
};

function WorksheetListItem({
  worksheet,
  isExpanded,
  onToggle,
  onDeleted,
  onRefresh,
}: WorksheetListItemProps) {
  const progressPercent =
    worksheet.progress.total > 0
      ? Math.round((worksheet.progress.completed / worksheet.progress.total) * 100)
      : 0;

  const isComplete = worksheet.status === "completed";

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        className={cn(
          "rounded-lg border transition-colors",
          isExpanded ? "border-primary/50 bg-muted/30" : "hover:bg-muted/50",
          isComplete && "opacity-75"
        )}
      >
        {/* Summary row */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full px-3 py-2.5 flex items-center gap-3 text-left"
          >
            <div className="text-muted-foreground">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                <span className="font-medium truncate">{worksheet.name}</span>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2 mt-1.5">
                <Progress
                  value={progressPercent}
                  className={cn(
                    "h-1.5 flex-1",
                    isComplete && "[&>div]:bg-green-600"
                  )}
                />
                <span className="text-xs text-muted-foreground shrink-0">
                  {worksheet.progress.completed}/{worksheet.progress.total}
                </span>
              </div>
            </div>

            {/* Date badge */}
            {worksheet.scheduledDate && (
              <div className="hidden sm:block text-xs text-muted-foreground">
                {format(new Date(worksheet.scheduledDate), "MMM d")}
              </div>
            )}
          </button>
        </CollapsibleTrigger>

        {/* Expanded detail view */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t">
            <WorksheetDetail
              worksheet={worksheet}
              onDeleted={onDeleted}
              onRefresh={onRefresh}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
