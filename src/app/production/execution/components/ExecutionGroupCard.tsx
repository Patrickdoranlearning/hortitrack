"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Printer, Trash2, MoveUp, MoveDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BatchListItem } from "./BatchListItem";
import { GroupFilterBar } from "./GroupFilterBar";
import type { PlanningBatch } from "@/lib/planning/types";
import type { ExecutionGroup, FilterCriteria } from "@/server/production/execution-groups";

type Props = {
  group: ExecutionGroup;
  batches: PlanningBatch[]; // Filtered batches (group + inline filters applied)
  baseBatches: PlanningBatch[]; // Base batches (only group filter applied, for filter options)
  onEdit: () => void;
  onDelete: () => void;
  onPrint: () => void;
  inlineFilters?: Partial<FilterCriteria>;
  onInlineFilterChange: (filters: Partial<FilterCriteria>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  // Selection props
  selectable?: boolean;
  selectedBatchIds?: Set<string>;
  onBatchSelectionChange?: (batchId: string, selected: boolean) => void;
  onSelectAllInGroup?: (groupId: string, batchIds: string[], selectAll: boolean) => void;
};

// Map of icon names to simple colored circles (can be replaced with real icons later)
const groupColorStyle = (color: string | null) => ({
  backgroundColor: color ?? "#6B7280",
});

export function ExecutionGroupCard({
  group,
  batches,
  baseBatches,
  onEdit,
  onDelete,
  onPrint,
  inlineFilters,
  onInlineFilterChange,
  onMoveUp,
  onMoveDown,
  selectable = false,
  selectedBatchIds,
  onBatchSelectionChange,
  onSelectAllInGroup,
}: Props) {
  const [isOpen, setIsOpen] = React.useState(true);

  const totalPlants = batches.reduce((sum, b) => sum + b.quantity, 0);

  // Calculate selection state for this group
  const batchIdsInGroup = React.useMemo(() => batches.map((b) => b.id), [batches]);
  const selectedInGroup = React.useMemo(() => {
    if (!selectedBatchIds) return 0;
    return batchIdsInGroup.filter((id) => selectedBatchIds.has(id)).length;
  }, [batchIdsInGroup, selectedBatchIds]);
  const allSelectedInGroup = batches.length > 0 && selectedInGroup === batches.length;
  const someSelectedInGroup = selectedInGroup > 0 && selectedInGroup < batches.length;

  const handleSelectAll = (checked: boolean) => {
    onSelectAllInGroup?.(group.id, batchIdsInGroup, checked);
  };

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Expand/collapse + group info */}
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="text-muted-foreground">
                  {isOpen ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </div>
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={groupColorStyle(group.color)}
                />
                <div className="text-left">
                  <h3 className="font-semibold">{group.name}</h3>
                  {group.description && (
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  )}
                </div>
              </button>
            </CollapsibleTrigger>

            {/* Right: Stats + actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Selection count badge */}
              {selectable && selectedInGroup > 0 && (
                <div className="bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                  {selectedInGroup} selected
                </div>
              )}
              <div className="hidden sm:block text-right text-sm">
                <span className="font-medium">{batches.length}</span>
                <span className="text-muted-foreground"> batches</span>
                <span className="text-muted-foreground mx-1">|</span>
                <span className="font-medium">{totalPlants.toLocaleString()}</span>
                <span className="text-muted-foreground"> plants</span>
              </div>
              {/* Compact mobile stats */}
              <div className="sm:hidden text-xs text-muted-foreground">
                {batches.length}b / {totalPlants.toLocaleString()}p
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={onPrint}
                disabled={batches.length === 0}
              >
                <Printer className="h-4 w-4" />
                <span className="sr-only">Print</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Group
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onPrint} disabled={batches.length === 0}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print Worksheet
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onMoveUp} disabled={!onMoveUp}>
                    <MoveUp className="mr-2 h-4 w-4" />
                    Move Up
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onMoveDown} disabled={!onMoveDown}>
                    <MoveDown className="mr-2 h-4 w-4" />
                    Move Down
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            {/* Inline filter bar - uses baseBatches so options don't disappear after filtering */}
            <GroupFilterBar
              batches={baseBatches}
              filters={inlineFilters}
              onChange={onInlineFilterChange}
            />

            {/* Batch list */}
            {batches.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No batches match the filter criteria for this group.
              </div>
            ) : (
              <div className="mt-3 border rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-muted/50">
                    <tr>
                      {selectable && (
                        <th className="px-3 py-2 w-8">
                          <Checkbox
                            checked={allSelectedInGroup}
                            ref={(el) => {
                              if (el) {
                                // Set indeterminate state for partial selection
                                (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelectedInGroup;
                              }
                            }}
                            onCheckedChange={(checked) => handleSelectAll(checked === true)}
                            aria-label="Select all batches in group"
                          />
                        </th>
                      )}
                      <th className="text-left px-3 py-2 font-medium w-10">#</th>
                      <th className="text-left px-3 py-2 font-medium">Variety</th>
                      <th className="text-left px-3 py-2 font-medium w-20">Size</th>
                      <th className="text-right px-3 py-2 font-medium w-20">Qty</th>
                      <th className="text-left px-3 py-2 font-medium w-28">Date/Week</th>
                      <th className="text-left px-3 py-2 font-medium">Supplier</th>
                      <th className="text-left px-3 py-2 font-medium w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {batches.map((batch, index) => (
                      <BatchListItem
                        key={batch.id}
                        batch={batch}
                        index={index + 1}
                        selectable={selectable}
                        selected={selectedBatchIds?.has(batch.id) ?? false}
                        onSelectChange={(selected) => onBatchSelectionChange?.(batch.id, selected)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary row */}
            {batches.length > 0 && (
              <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  Total: {batches.length} batch{batches.length !== 1 ? "es" : ""},{" "}
                  {totalPlants.toLocaleString()} plants
                </span>
                <Button variant="outline" size="sm" onClick={onPrint} className="w-full sm:w-auto">
                  <Printer className="mr-1.5 h-4 w-4" />
                  Print Group
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
