"use client";

import * as React from "react";
import useSWR from "swr";
import { Plus, Settings2, Printer, RotateCcw, Loader2, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ModulePageHeader } from "@/ui/templates";
import { ExecutionGroupCard } from "./components/ExecutionGroupCard";
import { ExecutionStats } from "./components/ExecutionStats";
import { GroupConfigDialog } from "./components/GroupConfigDialog";
import { PrintWorksheet } from "./components/PrintWorksheet";
import { CreateWorksheetDialog } from "./components/CreateWorksheetDialog";
import { WorksheetsPanel } from "./components/WorksheetsPanel";
import { fetchJson } from "@/lib/http/fetchJson";
import type { PlanningBatch } from "@/lib/planning/types";
import type { ExecutionGroup, FilterCriteria } from "@/server/production/execution-groups";

type Props = {
  initialGroups: ExecutionGroup[];
  initialBatches: PlanningBatch[];
};

type GroupsResponse = { groups: ExecutionGroup[] };
type BatchesResponse = { batches: PlanningBatch[] };

const groupsFetcher = (url: string) =>
  fetchJson<GroupsResponse>(url).then((res) => res.groups);

const batchesFetcher = (url: string) =>
  fetchJson<BatchesResponse>(url).then((res) => res.batches);

export default function ExecutionClient({ initialGroups, initialBatches }: Props) {
  // State for dialogs
  const [configOpen, setConfigOpen] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<ExecutionGroup | null>(null);
  const [printGroupId, setPrintGroupId] = React.useState<string | null>(null);
  const [printAllOpen, setPrintAllOpen] = React.useState(false);
  const [createWorksheetOpen, setCreateWorksheetOpen] = React.useState(false);

  // Batch selection state
  const [selectedBatchIds, setSelectedBatchIds] = React.useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = React.useState(false);

  // Inline filters per group (local state, not persisted)
  const [inlineFilters, setInlineFilters] = React.useState<Record<string, Partial<FilterCriteria>>>({});

  // SWR for groups
  const {
    data: groups = initialGroups,
    mutate: refreshGroups,
    isValidating: groupsLoading,
  } = useSWR("/api/production/execution-groups", groupsFetcher, {
    fallbackData: initialGroups,
  });

  // SWR for batches
  const {
    data: batches = initialBatches,
    isValidating: batchesLoading,
  } = useSWR("/api/production/planning/batches", batchesFetcher, {
    fallbackData: initialBatches,
  });

  // Filter batches for a specific group
  const filterBatchesForGroup = React.useCallback(
    (group: ExecutionGroup, additionalFilters?: Partial<FilterCriteria>): PlanningBatch[] => {
      const criteria = { ...group.filterCriteria, ...additionalFilters };

      return batches.filter((batch) => {
        // Status filter
        if (criteria.statuses && criteria.statuses.length > 0) {
          if (!criteria.statuses.includes(batch.status)) return false;
        }

        // Phase filter
        if (criteria.phases && criteria.phases.length > 0) {
          if (!batch.phase || !criteria.phases.includes(batch.phase)) return false;
        }

        // Supplier filter
        if (criteria.supplierIds && criteria.supplierIds.length > 0) {
          if (!batch.supplierId || !criteria.supplierIds.includes(batch.supplierId)) return false;
        }

        // Size filter
        if (criteria.sizeIds && criteria.sizeIds.length > 0) {
          if (!batch.sizeId || !criteria.sizeIds.includes(batch.sizeId)) return false;
        }

        // Variety filter
        if (criteria.varietyIds && criteria.varietyIds.length > 0) {
          if (!batch.varietyId || !criteria.varietyIds.includes(batch.varietyId)) return false;
        }

        // Location filter
        if (criteria.locationIds && criteria.locationIds.length > 0) {
          if (!batch.locationId || !criteria.locationIds.includes(batch.locationId)) return false;
        }

        // Week range filter
        if (criteria.weekRange) {
          const batchWeek = batch.readyDate ? getWeekNumber(new Date(batch.readyDate)) : null;
          if (batchWeek !== null) {
            if (criteria.weekRange.from !== undefined && batchWeek < criteria.weekRange.from) return false;
            if (criteria.weekRange.to !== undefined && batchWeek > criteria.weekRange.to) return false;
          }
        }

        // Date range filter
        if (criteria.dateRange) {
          const batchDate = batch.readyDate ? new Date(batch.readyDate) : null;
          if (batchDate !== null) {
            if (criteria.dateRange.from && batchDate < new Date(criteria.dateRange.from)) return false;
            if (criteria.dateRange.to && batchDate > new Date(criteria.dateRange.to)) return false;
          }
        }

        return true;
      });
    },
    [batches]
  );

  // Get base batches for each active group (group filter only, for filter options)
  const baseGroupedBatches = React.useMemo(() => {
    const result: Record<string, PlanningBatch[]> = {};
    for (const group of groups.filter((g) => g.isActive)) {
      result[group.id] = filterBatchesForGroup(group); // No inline filters
    }
    return result;
  }, [groups, filterBatchesForGroup]);

  // Get filtered batches for each active group (group + inline filters, for display)
  const groupedBatches = React.useMemo(() => {
    const result: Record<string, PlanningBatch[]> = {};
    for (const group of groups.filter((g) => g.isActive)) {
      const additionalFilters = inlineFilters[group.id];
      result[group.id] = filterBatchesForGroup(group, additionalFilters);
    }
    return result;
  }, [groups, inlineFilters, filterBatchesForGroup]);

  // Calculate stats
  const stats = React.useMemo(() => {
    const activeGroups = groups.filter((g) => g.isActive);
    let totalBatches = 0;
    let totalPlants = 0;
    const byStatus: Record<string, number> = {};

    for (const group of activeGroups) {
      const groupBatches = groupedBatches[group.id] ?? [];
      totalBatches += groupBatches.length;

      for (const batch of groupBatches) {
        totalPlants += batch.quantity;
        byStatus[batch.status] = (byStatus[batch.status] ?? 0) + 1;
      }
    }

    return { totalBatches, totalPlants, byStatus, groupCount: activeGroups.length };
  }, [groups, groupedBatches]);

  // Handlers
  const handleCreateGroup = () => {
    setEditingGroup(null);
    setConfigOpen(true);
  };

  const handleEditGroup = (group: ExecutionGroup) => {
    setEditingGroup(group);
    setConfigOpen(true);
  };

  const handleGroupSaved = () => {
    setConfigOpen(false);
    setEditingGroup(null);
    refreshGroups();
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await fetchJson(`/api/production/execution-groups/${groupId}`, {
        method: "DELETE",
      });
      refreshGroups();
    } catch (error) {
      console.error("Failed to delete group:", error);
    }
  };

  const handleResetGroups = async () => {
    if (!confirm("Reset all groups to defaults? This will delete your custom groups.")) {
      return;
    }
    try {
      await fetchJson("/api/production/execution-groups/reset", {
        method: "POST",
      });
      refreshGroups();
    } catch (error) {
      console.error("Failed to reset groups:", error);
    }
  };

  const handlePrintGroup = (groupId: string) => {
    setPrintGroupId(groupId);
  };

  const handlePrintAll = () => {
    setPrintAllOpen(true);
  };

  const handleInlineFilterChange = (groupId: string, filters: Partial<FilterCriteria>) => {
    setInlineFilters((prev) => ({
      ...prev,
      [groupId]: filters,
    }));
  };

  // Batch selection handlers
  const handleBatchSelectionChange = (batchId: string, selected: boolean) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(batchId);
      } else {
        next.delete(batchId);
      }
      return next;
    });
  };

  const handleSelectAllInGroup = (_groupId: string, batchIds: string[], selectAll: boolean) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      for (const id of batchIds) {
        if (selectAll) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedBatchIds(new Set());
    setSelectionMode(false);
  };

  const handleToggleSelectionMode = () => {
    if (selectionMode) {
      // Exiting selection mode, clear selection
      setSelectedBatchIds(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  const handleWorksheetCreated = () => {
    // Clear selection after worksheet is created
    setSelectedBatchIds(new Set());
    setSelectionMode(false);
  };

  const handleMoveGroup = async (groupId: string, direction: "up" | "down") => {
    const activeGroupsList = groups.filter((g) => g.isActive);
    const currentIndex = activeGroupsList.findIndex((g) => g.id === groupId);

    if (currentIndex === -1) return;
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === activeGroupsList.length - 1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const reorderedGroups = [...activeGroupsList];
    const [movedGroup] = reorderedGroups.splice(currentIndex, 1);
    reorderedGroups.splice(newIndex, 0, movedGroup);

    // Optimistic update
    const optimisticGroups = reorderedGroups.map((g, i) => ({
      ...g,
      sortOrder: i + 1,
    }));
    refreshGroups(optimisticGroups, false);

    try {
      await fetchJson("/api/production/execution-groups/reorder", {
        method: "POST",
        body: JSON.stringify({ groupIds: reorderedGroups.map((g) => g.id) }),
      });
      refreshGroups();
    } catch {
      // Revert on error
      refreshGroups();
    }
  };

  const activeGroups = groups.filter((g) => g.isActive);
  const printGroup = printGroupId ? groups.find((g) => g.id === printGroupId) : null;

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Cmd/Ctrl + N: Create new group
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleCreateGroup();
        return;
      }

      // Cmd/Ctrl + P: Print all
      if ((e.metaKey || e.ctrlKey) && e.key === "p" && activeGroups.length > 0) {
        e.preventDefault();
        handlePrintAll();
        return;
      }

      // Escape: Close dialogs/print views
      if (e.key === "Escape") {
        if (configOpen) {
          setConfigOpen(false);
        }
        if (printGroupId) {
          setPrintGroupId(null);
        }
        if (printAllOpen) {
          setPrintAllOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [configOpen, printGroupId, printAllOpen, activeGroups.length]);

  return (
    <>
      <div className="space-y-6">
        <ModulePageHeader
          title="Execution"
          description="Organize batch execution plans into groups and print worksheets for staff."
          actionsSlot={
            <>
              {/* Selection mode controls */}
              {selectionMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearSelection}
                    disabled={selectedBatchIds.size === 0}
                  >
                    <X className="mr-1.5 h-4 w-4" />
                    Clear ({selectedBatchIds.size})
                  </Button>
                  <Button
                    onClick={() => setCreateWorksheetOpen(true)}
                    disabled={selectedBatchIds.size === 0}
                  >
                    <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                    Create Worksheet ({selectedBatchIds.size})
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleToggleSelectionMode}>
                    Done
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleToggleSelectionMode}>
                    <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                    Select Batches
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleResetGroups}>
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                    Reset
                  </Button>
                  <Button variant="outline" onClick={handlePrintAll} disabled={activeGroups.length === 0}>
                    <Printer className="mr-1.5 h-4 w-4" />
                    Print All
                  </Button>
                  <Button onClick={handleCreateGroup}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Group
                  </Button>
                </>
              )}
            </>
          }
        />

        {/* Stats Summary */}
        <ExecutionStats
          totalBatches={stats.totalBatches}
          totalPlants={stats.totalPlants}
          groupCount={stats.groupCount}
          byStatus={stats.byStatus}
        />

        {/* Saved Worksheets Panel */}
        <WorksheetsPanel />

        {/* Loading skeleton state */}
        {(groupsLoading || batchesLoading) && groups.length === 0 && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Refreshing indicator (when we have data already) */}
        {(groupsLoading || batchesLoading) && groups.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Refreshing data...
          </div>
        )}

        {/* Empty state */}
        {activeGroups.length === 0 && !groupsLoading && (
          <div className="border rounded-lg p-8 text-center max-w-xl mx-auto">
            <Settings2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold text-lg">Set up your execution groups</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Groups help you organize batches by production phase (Incoming, Propagation, Potting, etc.)
              and generate printable worksheets for your team.
            </p>
            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              <p>1. Create groups with filters for batch status and phase</p>
              <p>2. Batches automatically appear in matching groups</p>
              <p>3. Print worksheets for staff to track execution</p>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={handleCreateGroup}>
                <Plus className="mr-1.5 h-4 w-4" />
                Create First Group
              </Button>
              <Button variant="outline" onClick={handleResetGroups}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Use Default Groups
              </Button>
            </div>
          </div>
        )}

        {/* Selection mode banner */}
        {selectionMode && (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <span className="font-medium">Selection Mode</span>
              <span className="text-muted-foreground">
                - Select batches to create an execution worksheet
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedBatchIds.size} batch{selectedBatchIds.size !== 1 ? "es" : ""} selected
              </span>
              {selectedBatchIds.size > 0 && (
                <Button
                  size="sm"
                  onClick={() => setCreateWorksheetOpen(true)}
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                  Create Worksheet
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Group Cards */}
        <div className="space-y-4">
          {activeGroups.map((group, index) => (
            <ExecutionGroupCard
              key={group.id}
              group={group}
              batches={groupedBatches[group.id] ?? []}
              baseBatches={baseGroupedBatches[group.id] ?? []}
              onEdit={() => handleEditGroup(group)}
              onDelete={() => handleDeleteGroup(group.id)}
              onPrint={() => handlePrintGroup(group.id)}
              inlineFilters={inlineFilters[group.id]}
              onInlineFilterChange={(filters) => handleInlineFilterChange(group.id, filters)}
              onMoveUp={index > 0 ? () => handleMoveGroup(group.id, "up") : undefined}
              onMoveDown={index < activeGroups.length - 1 ? () => handleMoveGroup(group.id, "down") : undefined}
              selectable={selectionMode}
              selectedBatchIds={selectedBatchIds}
              onBatchSelectionChange={handleBatchSelectionChange}
              onSelectAllInGroup={handleSelectAllInGroup}
            />
          ))}
        </div>

        {/* Add Group Button at bottom */}
        {activeGroups.length > 0 && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={handleCreateGroup}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Group
            </Button>
          </div>
        )}
      </div>

      {/* Group Config Dialog */}
      <GroupConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        group={editingGroup}
        onSaved={handleGroupSaved}
        batches={batches}
      />

      {/* Print Single Group */}
      {printGroup && (
        <PrintWorksheet
          groups={[printGroup]}
          groupedBatches={{ [printGroup.id]: groupedBatches[printGroup.id] ?? [] }}
          onClose={() => setPrintGroupId(null)}
        />
      )}

      {/* Print All Groups */}
      {printAllOpen && (
        <PrintWorksheet
          groups={activeGroups}
          groupedBatches={groupedBatches}
          onClose={() => setPrintAllOpen(false)}
        />
      )}

      {/* Create Worksheet Dialog */}
      <CreateWorksheetDialog
        open={createWorksheetOpen}
        onOpenChange={setCreateWorksheetOpen}
        selectedBatchIds={Array.from(selectedBatchIds)}
        onSuccess={handleWorksheetCreated}
      />
    </>
  );
}

// Helper function to get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
