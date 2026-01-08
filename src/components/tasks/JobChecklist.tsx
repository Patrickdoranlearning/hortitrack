"use client";

import * as React from "react";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type {
  ChecklistTemplate,
  ChecklistItem,
  ChecklistProgress,
  ChecklistItemProgress,
  ChecklistType,
} from "@/server/tasks/checklist-service";

export type ChecklistStatus = "incomplete" | "complete" | "skipped_with_warnings";

type Props = {
  templates: ChecklistTemplate[];
  progress: ChecklistProgress;
  checklistType: ChecklistType;
  onProgressChange: (progress: ChecklistProgress) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * A reusable checklist component for task prerequisites and postrequisites.
 * Features:
 * - Interactive checkboxes for each item
 * - Advisory warnings (not blocking)
 * - Skip with reason for unchecked items
 * - Visual progress tracking
 */
export function JobChecklist({
  templates,
  progress,
  checklistType,
  onProgressChange,
  disabled = false,
  className,
}: Props) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [skipDialogOpen, setSkipDialogOpen] = React.useState(false);
  const [skipReason, setSkipReason] = React.useState("");
  const [itemToSkip, setItemToSkip] = React.useState<ChecklistItem | null>(null);

  // Get all items from templates
  const allItems = React.useMemo(() => {
    return templates.flatMap((t) => t.items);
  }, [templates]);

  // Get progress for current checklist type
  const progressList = (checklistType === "prerequisite"
    ? progress?.prerequisites
    : progress?.postrequisites) ?? [];

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
    };
  }, [allItems, progressList]);

  const handleCheckItem = (itemId: string, checked: boolean) => {
    const updatedList = progressList.map((p) =>
      p.itemId === itemId
        ? { ...p, checked, skippedReason: checked ? undefined : p.skippedReason, timestamp: new Date().toISOString() }
        : p
    );

    // If item doesn't exist in progress, add it
    const exists = updatedList.some((p) => p.itemId === itemId);
    if (!exists) {
      updatedList.push({
        itemId,
        checked,
        timestamp: new Date().toISOString(),
      });
    }

    onProgressChange({
      ...progress,
      [checklistType === "prerequisite" ? "prerequisites" : "postrequisites"]: updatedList,
    });
  };

  const handleSkipItem = () => {
    if (!itemToSkip || !skipReason.trim()) return;

    const updatedList = progressList.map((p) =>
      p.itemId === itemToSkip.id
        ? { ...p, checked: false, skippedReason: skipReason.trim(), timestamp: new Date().toISOString() }
        : p
    );

    // If item doesn't exist in progress, add it
    const exists = updatedList.some((p) => p.itemId === itemToSkip.id);
    if (!exists) {
      updatedList.push({
        itemId: itemToSkip.id,
        checked: false,
        skippedReason: skipReason.trim(),
        timestamp: new Date().toISOString(),
      });
    }

    onProgressChange({
      ...progress,
      [checklistType === "prerequisite" ? "prerequisites" : "postrequisites"]: updatedList,
    });

    setSkipDialogOpen(false);
    setItemToSkip(null);
    setSkipReason("");
  };

  const openSkipDialog = (item: ChecklistItem) => {
    setItemToSkip(item);
    setSkipReason("");
    setSkipDialogOpen(true);
  };

  if (templates.length === 0 || allItems.length === 0) {
    return null;
  }

  const title = checklistType === "prerequisite" ? "Prerequisites" : "Postrequisites";
  const description = checklistType === "prerequisite"
    ? "Complete these items before starting"
    : "Complete these items before finishing";

  return (
    <div className={className}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <h4 className="font-medium text-sm">{title}</h4>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ProgressBadge stats={stats} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 border rounded-lg divide-y">
            {allItems.map((item) => {
              const itemProgress = progressList?.find((p) => p.itemId === item.id);
              const isChecked = itemProgress?.checked ?? false;
              const isSkipped = !!itemProgress?.skippedReason && !isChecked;

              return (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  isChecked={isChecked}
                  isSkipped={isSkipped}
                  skipReason={itemProgress?.skippedReason}
                  disabled={disabled}
                  onCheck={(checked) => handleCheckItem(item.id, checked)}
                  onSkip={() => openSkipDialog(item)}
                />
              );
            })}
          </div>

          {/* Warning for incomplete items */}
          {stats.unchecked > 0 && !disabled && (
            <Alert variant="default" className="mt-3 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-200">
                {stats.unchecked} item{stats.unchecked !== 1 ? "s" : ""} unchecked
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                You can proceed without completing all items, but consider checking them off or providing a reason for skipping.
              </AlertDescription>
            </Alert>
          )}

          {/* Skipped items notice */}
          {stats.skipped > 0 && (
            <Alert variant="default" className="mt-3 border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
              <SkipForward className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 dark:text-blue-200">
                {stats.skipped} item{stats.skipped !== 1 ? "s" : ""} skipped
              </AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                Skipped items have been recorded with reasons for audit purposes.
              </AlertDescription>
            </Alert>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Skip Dialog */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Skip Checklist Item</DialogTitle>
            <DialogDescription>
              Please provide a reason for skipping this item. This will be recorded for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-md bg-muted">
              <span className="text-sm font-medium">{itemToSkip?.label}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skip-reason">Reason for skipping</Label>
              <Textarea
                id="skip-reason"
                placeholder="e.g., Not applicable today, Equipment not available..."
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSkipDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSkipItem} disabled={!skipReason.trim()}>
              <SkipForward className="mr-2 h-4 w-4" />
              Skip Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Progress Badge Component
function ProgressBadge({ stats }: { stats: { total: number; checked: number; skipped: number; unchecked: number; isComplete: boolean } }) {
  if (stats.isComplete) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Complete
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      {stats.checked + stats.skipped} / {stats.total}
    </Badge>
  );
}

// Checklist Item Row Component
function ChecklistItemRow({
  item,
  isChecked,
  isSkipped,
  skipReason,
  disabled,
  onCheck,
  onSkip,
}: {
  item: ChecklistItem;
  isChecked: boolean;
  isSkipped: boolean;
  skipReason?: string;
  disabled: boolean;
  onCheck: (checked: boolean) => void;
  onSkip: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 transition-colors",
        isChecked && "bg-green-50/50 dark:bg-green-950/20",
        isSkipped && "bg-blue-50/50 dark:bg-blue-950/20"
      )}
    >
      <div className="pt-0.5">
        {isChecked ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : isSkipped ? (
          <SkipForward className="h-5 w-5 text-blue-600" />
        ) : (
          <Checkbox
            id={item.id}
            checked={isChecked}
            onCheckedChange={(checked) => onCheck(checked === true)}
            disabled={disabled}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Label
          htmlFor={item.id}
          className={cn(
            "text-sm cursor-pointer",
            isChecked && "line-through text-muted-foreground",
            isSkipped && "text-muted-foreground"
          )}
        >
          {item.label}
          {item.required && (
            <span className="ml-1 text-xs text-amber-600">*</span>
          )}
        </Label>
        {isSkipped && skipReason && (
          <p className="text-xs text-blue-600 mt-1">
            Skipped: {skipReason}
          </p>
        )}
      </div>
      {!isChecked && !isSkipped && !disabled && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={onSkip}
        >
          Skip
        </Button>
      )}
    </div>
  );
}

/**
 * Helper function to check if a checklist is complete
 */
export function isChecklistComplete(
  templates: ChecklistTemplate[],
  progress: ChecklistProgress,
  checklistType: ChecklistType
): ChecklistStatus {
  const items = templates.flatMap((t) => t.items);
  const progressList = (checklistType === "prerequisite"
    ? progress?.prerequisites
    : progress?.postrequisites) ?? [];

  let unchecked = 0;
  let skipped = 0;

  for (const item of items) {
    const p = progressList?.find((prog) => prog.itemId === item.id);
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

/**
 * Helper to initialize progress from templates
 */
export function initializeProgressFromTemplates(
  templates: ChecklistTemplate[]
): ChecklistProgress {
  const prerequisites = templates
    .filter((t) => t.checklistType === "prerequisite")
    .flatMap((t) => t.items)
    .map((item) => ({ itemId: item.id, checked: false }));

  const postrequisites = templates
    .filter((t) => t.checklistType === "postrequisite")
    .flatMap((t) => t.items)
    .map((item) => ({ itemId: item.id, checked: false }));

  return { prerequisites, postrequisites };
}

