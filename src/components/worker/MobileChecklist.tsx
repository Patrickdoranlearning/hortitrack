"use client";

import * as React from "react";
import {
  CheckCircle2,
  Circle,
  SkipForward,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  ChecklistTemplate,
  ChecklistProgress,
  ChecklistItemProgress,
  ChecklistType,
} from "@/server/tasks/checklist-service";

export type MobileChecklistStatus = "incomplete" | "complete" | "skipped_with_warnings";

interface MobileChecklistProps {
  templates: ChecklistTemplate[];
  progress: ChecklistProgress;
  checklistType: ChecklistType;
  onProgressChange: (progress: ChecklistProgress) => void;
  onComplete: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Mobile-optimized checklist component for the worker app.
 * Shows one item at a time with large touch targets and swipe/skip support.
 */
export function MobileChecklist({
  templates,
  progress,
  checklistType,
  onProgressChange,
  onComplete,
  disabled = false,
  className,
}: MobileChecklistProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [skipDialogOpen, setSkipDialogOpen] = React.useState(false);
  const [skipReason, setSkipReason] = React.useState("");

  // Get all items from templates
  const allItems = React.useMemo(() => {
    return templates.flatMap((t) => t.items);
  }, [templates]);

  // Get progress for current checklist type
  const progressList = React.useMemo(() => {
    return (checklistType === "prerequisite"
      ? progress?.prerequisites
      : progress?.postrequisites) ?? [];
  }, [checklistType, progress]);

  // Find first uncompleted item on mount
  React.useEffect(() => {
    const firstUncompleted = allItems.findIndex((item) => {
      const p = progressList.find((prog) => prog.itemId === item.id);
      return !p?.checked && !p?.skippedReason;
    });
    if (firstUncompleted >= 0) {
      setCurrentIndex(firstUncompleted);
    }
  }, [allItems, progressList]);

  // Calculate stats
  const stats = React.useMemo(() => {
    let checked = 0;
    let skipped = 0;
    let unchecked = 0;

    for (const item of allItems) {
      const p = progressList.find((prog) => prog.itemId === item.id);
      if (p?.checked) {
        checked++;
      } else if (p?.skippedReason) {
        skipped++;
      } else {
        unchecked++;
      }
    }

    return {
      total: allItems.length,
      checked,
      skipped,
      unchecked,
      isComplete: unchecked === 0,
      progressPercent: allItems.length > 0
        ? Math.round(((checked + skipped) / allItems.length) * 100)
        : 100,
    };
  }, [allItems, progressList]);

  // Current item
  const currentItem = allItems[currentIndex];
  const currentProgress = progressList.find((p) => p.itemId === currentItem?.id);
  const isCurrentChecked = currentProgress?.checked ?? false;
  const isCurrentSkipped = !!currentProgress?.skippedReason && !isCurrentChecked;

  const updateProgress = (itemId: string, update: Partial<ChecklistItemProgress>) => {
    const updatedList = [...progressList];
    const existingIndex = updatedList.findIndex((p) => p.itemId === itemId);

    const newProgress: ChecklistItemProgress = {
      itemId,
      checked: update.checked ?? false,
      skippedReason: update.skippedReason,
      timestamp: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      updatedList[existingIndex] = newProgress;
    } else {
      updatedList.push(newProgress);
    }

    onProgressChange({
      ...progress,
      [checklistType === "prerequisite" ? "prerequisites" : "postrequisites"]: updatedList,
    });
  };

  const handleCheck = () => {
    if (disabled || !currentItem) return;

    updateProgress(currentItem.id, { checked: true });

    // Auto-advance to next uncompleted item
    const nextUncompleted = findNextUncompleted(currentIndex + 1);
    if (nextUncompleted >= 0) {
      setCurrentIndex(nextUncompleted);
    } else if (stats.unchecked <= 1) {
      // This was the last item
      onComplete();
    }
  };

  const handleSkip = () => {
    if (!currentItem || !skipReason.trim()) return;

    updateProgress(currentItem.id, {
      checked: false,
      skippedReason: skipReason.trim(),
    });

    setSkipDialogOpen(false);
    setSkipReason("");

    // Auto-advance to next uncompleted item
    const nextUncompleted = findNextUncompleted(currentIndex + 1);
    if (nextUncompleted >= 0) {
      setCurrentIndex(nextUncompleted);
    } else if (stats.unchecked <= 1) {
      // This was the last item
      onComplete();
    }
  };

  const findNextUncompleted = (startFrom: number): number => {
    for (let i = startFrom; i < allItems.length; i++) {
      const item = allItems[i];
      const p = progressList.find((prog) => prog.itemId === item.id);
      if (!p?.checked && !p?.skippedReason) {
        return i;
      }
    }
    // Wrap around
    for (let i = 0; i < startFrom; i++) {
      const item = allItems[i];
      const p = progressList.find((prog) => prog.itemId === item.id);
      if (!p?.checked && !p?.skippedReason) {
        return i;
      }
    }
    return -1;
  };

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < allItems.length - 1;

  if (allItems.length === 0) {
    return null;
  }

  const title = checklistType === "prerequisite" ? "Prerequisites" : "Postrequisites";

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with progress */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-base">{title}</h3>
          <span className="text-sm text-muted-foreground">
            {stats.checked + stats.skipped} / {stats.total}
          </span>
        </div>
        <Progress value={stats.progressPercent} className="h-2" />
      </div>

      {/* Main content - single item view */}
      <div className="flex-1 flex flex-col justify-center px-4 py-6">
        {/* Navigation indicators */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {allItems.map((item, idx) => {
            const p = progressList.find((prog) => prog.itemId === item.id);
            const isCompleted = p?.checked || !!p?.skippedReason;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  "w-3 h-3 rounded-full transition-all",
                  idx === currentIndex
                    ? "bg-primary scale-125"
                    : isCompleted
                    ? "bg-green-500"
                    : "bg-muted-foreground/30"
                )}
                aria-label={`Go to item ${idx + 1}`}
              />
            );
          })}
        </div>

        {/* Current item card */}
        {currentItem && (
          <div
            className={cn(
              "rounded-xl border-2 p-6 text-center transition-all",
              isCurrentChecked && "border-green-500 bg-green-50 dark:bg-green-950/20",
              isCurrentSkipped && "border-blue-500 bg-blue-50 dark:bg-blue-950/20",
              !isCurrentChecked && !isCurrentSkipped && "border-border"
            )}
          >
            {/* Status icon */}
            <div className="flex justify-center mb-4">
              {isCurrentChecked ? (
                <CheckCircle2 className="h-16 w-16 text-green-600" />
              ) : isCurrentSkipped ? (
                <SkipForward className="h-16 w-16 text-blue-600" />
              ) : (
                <Circle className="h-16 w-16 text-muted-foreground/50" />
              )}
            </div>

            {/* Item number */}
            <p className="text-sm text-muted-foreground mb-2">
              Step {currentIndex + 1} of {allItems.length}
            </p>

            {/* Item label */}
            <p
              className={cn(
                "text-lg font-medium",
                (isCurrentChecked || isCurrentSkipped) && "text-muted-foreground"
              )}
            >
              {currentItem.label}
            </p>

            {/* Skip reason if skipped */}
            {isCurrentSkipped && currentProgress?.skippedReason && (
              <p className="text-sm text-blue-600 mt-2">
                Skipped: {currentProgress.skippedReason}
              </p>
            )}

            {/* Required indicator */}
            {currentItem.required && !isCurrentChecked && !isCurrentSkipped && (
              <p className="text-xs text-amber-600 mt-2">Required step</p>
            )}
          </div>
        )}

        {/* Navigation arrows */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={!canGoPrevious}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12"
            onClick={() => setCurrentIndex((i) => Math.min(allItems.length - 1, i + 1))}
            disabled={!canGoNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Bottom action buttons - fixed */}
      <div className="p-4 border-t bg-background safe-area-inset-bottom">
        {isCurrentChecked || isCurrentSkipped ? (
          // Item already completed - show navigation or complete button
          stats.isComplete ? (
            <Button
              className="w-full h-14 text-lg font-semibold"
              onClick={onComplete}
            >
              Continue
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-14 text-base"
                onClick={() => {
                  const next = findNextUncompleted(currentIndex);
                  if (next >= 0) setCurrentIndex(next);
                }}
              >
                Next Unchecked
              </Button>
              {stats.unchecked === 0 && (
                <Button
                  className="flex-1 h-14 text-base font-semibold"
                  onClick={onComplete}
                >
                  Continue
                </Button>
              )}
            </div>
          )
        ) : (
          // Item needs action
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="h-14 px-6"
              onClick={() => setSkipDialogOpen(true)}
              disabled={disabled}
            >
              <SkipForward className="mr-2 h-5 w-5" />
              Skip
            </Button>
            <Button
              className="flex-1 h-14 text-lg font-semibold"
              onClick={handleCheck}
              disabled={disabled}
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Done
            </Button>
          </div>
        )}
      </div>

      {/* Skip Dialog */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Skip This Step</DialogTitle>
            <DialogDescription>
              Please provide a reason for skipping. This will be recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-md bg-muted">
              <span className="text-sm font-medium">{currentItem?.label}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skip-reason">Reason</Label>
              <Textarea
                id="skip-reason"
                placeholder="Why are you skipping this step?"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                rows={3}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              onClick={() => setSkipDialogOpen(false)}
              className="h-12"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSkip}
              disabled={!skipReason.trim()}
              className="h-12"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Skip Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Helper to check if checklist is complete
 */
export function isMobileChecklistComplete(
  templates: ChecklistTemplate[],
  progress: ChecklistProgress,
  checklistType: ChecklistType
): MobileChecklistStatus {
  const items = templates.flatMap((t) => t.items);
  const progressList = (checklistType === "prerequisite"
    ? progress?.prerequisites
    : progress?.postrequisites) ?? [];

  let unchecked = 0;
  let skipped = 0;

  for (const item of items) {
    const p = progressList.find((prog) => prog.itemId === item.id);
    if (p?.checked) {
      continue;
    } else if (p?.skippedReason) {
      skipped++;
    } else {
      unchecked++;
    }
  }

  if (unchecked === 0 && skipped === 0) {
    return "complete";
  } else if (unchecked === 0 && skipped > 0) {
    return "skipped_with_warnings";
  }
  return "incomplete";
}
