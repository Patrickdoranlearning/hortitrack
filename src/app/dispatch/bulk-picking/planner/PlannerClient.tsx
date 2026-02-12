'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/lib/toast';
import { format } from 'date-fns';
import {
  RefreshCw,
  User,
  Printer,
  Wand2,
  Package,
  Truck,
  Boxes,
  MapPin,
  Loader2,
  CalendarDays,
  ClipboardList,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import type {
  PlannerBatch,
  PlannerPickItem,
  PlannerPicker,
  PlannerSizeCategory,
} from './page';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlannerClientProps {
  batches: PlannerBatch[];
  items: PlannerPickItem[];
  pickers: PlannerPicker[];
  sizeCategories: PlannerSizeCategory[];
  todayDate: string;
}

// ---------------------------------------------------------------------------
// Status colours (consistent with BulkPickingClient)
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  picked: 'bg-amber-100 text-amber-700',
  packing: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'Picking',
  picked: 'Picked',
  packing: 'Packing',
  completed: 'Completed',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlannerClient({
  batches: initialBatches,
  items: initialItems,
  pickers,
  sizeCategories: _sizeCategories,
  todayDate,
}: PlannerClientProps) {
  const router = useRouter();

  // ---- State ----
  const [items, setItems] = useState<PlannerPickItem[]>(initialItems);
  const [batches] = useState<PlannerBatch[]>(initialBatches);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoAssignLoadingBatch, setAutoAssignLoadingBatch] = useState<string | null>(null);
  const [manualAssignLoading, setManualAssignLoading] = useState<string | null>(null);
  const [expandedPickers, setExpandedPickers] = useState<Set<string>>(new Set());

  // ---- Derived data ----
  const totalOrders = batches.reduce((sum, b) => sum + b.orderCount, 0);
  const totalItems = items.length;
  const totalUnits = items.reduce((sum, i) => sum + i.totalQty, 0);
  const pickedUnits = items.reduce((sum, i) => sum + i.pickedQty, 0);

  /** Items grouped by assigned picker (null = unassigned) */
  const itemsByPicker = useMemo(() => {
    const map = new Map<string | null, PlannerPickItem[]>();
    for (const item of items) {
      const key = item.assignedTo;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  const unassignedItems = itemsByPicker.get(null) || [];

  /** Compute stats per picker */
  const pickerStats = useMemo(() => {
    const stats = new Map<
      string,
      { totalUnits: number; pickedUnits: number; itemCount: number }
    >();

    for (const picker of pickers) {
      const pickerItems = itemsByPicker.get(picker.id) || [];
      const total = pickerItems.reduce((s, i) => s + i.totalQty, 0);
      const picked = pickerItems.reduce((s, i) => s + i.pickedQty, 0);
      stats.set(picker.id, {
        totalUnits: total,
        pickedUnits: picked,
        itemCount: pickerItems.length,
      });
    }

    return stats;
  }, [pickers, itemsByPicker]);

  // ---- Handlers ----

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    // Small delay so user sees the spinner
    setTimeout(() => setIsRefreshing(false), 800);
  }, [router]);

  const handleAutoAssign = useCallback(
    async (batchId: string) => {
      setAutoAssignLoadingBatch(batchId);
      try {
        const res = await fetch(`/api/bulk-picking/${batchId}/assign`, {
          method: 'POST',
        });
        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error || 'Auto-assign failed');
          return;
        }

        toast.success(
          `Assigned ${data.summary?.assigned ?? 0} items to pickers`
        );
        router.refresh();
      } catch (error) {
        toast.error(error, { fallback: 'Failed to auto-assign items' });
      } finally {
        setAutoAssignLoadingBatch(null);
      }
    },
    [router]
  );

  const handleManualAssign = useCallback(
    async (itemId: string, assignedTo: string | null, batchId: string) => {
      setManualAssignLoading(itemId);
      try {
        const res = await fetch(`/api/bulk-picking/${batchId}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, assignedTo }),
        });
        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error || 'Failed to assign item');
          return;
        }

        // Update local state optimistically
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== itemId) return item;
            const picker = pickers.find((p) => p.id === assignedTo);
            return {
              ...item,
              assignedTo,
              assignedName: picker?.displayName ?? null,
            };
          })
        );

        toast.success('Item assigned');
      } catch (error) {
        toast.error(error, { fallback: 'Failed to assign item' });
      } finally {
        setManualAssignLoading(null);
      }
    },
    [pickers]
  );

  const togglePickerExpand = useCallback((pickerId: string) => {
    setExpandedPickers((prev) => {
      const next = new Set(prev);
      if (next.has(pickerId)) {
        next.delete(pickerId);
      } else {
        next.add(pickerId);
      }
      return next;
    });
  }, []);

  /** Find which batch an item belongs to (for API calls) */
  const findBatchIdForItem = useCallback(
    (itemId: string): string | null => {
      const item = items.find((i) => i.id === itemId);
      if (item?.batchId) return item.batchId;
      // Fallback: use first batch
      return batches[0]?.id ?? null;
    },
    [items, batches]
  );

  // ---- Render helpers ----

  const formattedDate = format(new Date(todayDate), 'EEEE, d MMMM');

  const renderItemRow = (item: PlannerPickItem, showAssignDropdown: boolean) => {
    const batchId = findBatchIdForItem(item.id);
    const isLoading = manualAssignLoading === item.id;

    return (
      <div
        key={item.id}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border transition-colors',
          item.status === 'picked' && 'bg-green-50 border-green-200 opacity-75',
          item.status === 'short' && 'bg-red-50 border-red-200'
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{item.productName}</span>
            {item.sizeCategoryName && (
              <Badge
                variant="outline"
                className="text-xs shrink-0"
                style={{
                  borderColor: item.sizeCategoryColor || undefined,
                  color: item.sizeCategoryColor || undefined,
                }}
              >
                {item.sizeCategoryName}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{item.size}</span>
            {item.locationHint && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {item.locationHint}
              </span>
            )}
          </div>
        </div>

        <Badge variant="secondary" className="shrink-0 font-mono">
          {item.status === 'picked' || item.status === 'short'
            ? `${item.pickedQty}/${item.totalQty}`
            : `x${item.totalQty}`}
        </Badge>

        {showAssignDropdown && batchId && (
          <div className="shrink-0 w-36">
            {isLoading ? (
              <div className="flex items-center justify-center h-9">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select
                value={item.assignedTo ?? 'unassigned'}
                onValueChange={(value) => {
                  const newAssignee = value === 'unassigned' ? null : value;
                  handleManualAssign(item.id, newAssignee, batchId);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    <span className="text-muted-foreground">Unassigned</span>
                  </SelectItem>
                  {pickers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>
    );
  };

  // ---- Empty state ----

  if (batches.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Batches for Today</h3>
          <p className="text-muted-foreground mb-4">
            There are no active bulk picking batches for {formattedDate}.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/dispatch/bulk-picking')}
            >
              <Boxes className="h-4 w-4 mr-2" />
              Go to Bulk Picking
            </Button>
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Main render ----

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Summary Bar                                                        */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Morning Plan - {formattedDate}
              </h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Truck className="h-4 w-4" />
                  {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
                </span>
                <span className="flex items-center gap-1">
                  <ClipboardList className="h-4 w-4" />
                  {totalOrders} orders
                </span>
                <span className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  {totalUnits} units
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Overall progress */}
          {totalUnits > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium">
                  {pickedUnits}/{totalUnits} units ({Math.round((pickedUnits / totalUnits) * 100)}%)
                </span>
              </div>
              <Progress
                value={totalUnits > 0 ? (pickedUnits / totalUnits) * 100 : 0}
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Batch Quick Actions                                                */}
      {/* ----------------------------------------------------------------- */}
      {batches.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {batches.map((batch) => (
            <Card key={batch.id} className="border-l-4" style={{ borderLeftColor: '#3b82f6' }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{batch.batchNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {batch.orderCount} orders / {batch.itemCount} items
                    </p>
                  </div>
                  <Badge className={cn('text-xs', STATUS_COLORS[batch.status])}>
                    {STATUS_LABELS[batch.status] || batch.status}
                  </Badge>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => handleAutoAssign(batch.id)}
                    disabled={autoAssignLoadingBatch === batch.id}
                  >
                    {autoAssignLoadingBatch === batch.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Wand2 className="h-3 w-3 mr-1" />
                    )}
                    Auto-Assign
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => router.push(`/dispatch/bulk-picking/${batch.id}`)}
                  >
                    Open
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Picker Columns                                                     */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <User className="h-5 w-5" />
          Pickers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pickers.map((picker) => {
            const stats = pickerStats.get(picker.id);
            const pickerItems = itemsByPicker.get(picker.id) || [];
            const progress =
              stats && stats.totalUnits > 0
                ? Math.round((stats.pickedUnits / stats.totalUnits) * 100)
                : 0;
            const isExpanded = expandedPickers.has(picker.id);

            return (
              <Card key={picker.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <span className="block">{picker.displayName}</span>
                        {picker.specializations.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {picker.specializations.map((spec) => (
                              <Badge
                                key={spec.categoryId}
                                variant="outline"
                                className="text-[10px] py-0"
                                style={{
                                  borderColor: spec.categoryColor || undefined,
                                  color: spec.categoryColor || undefined,
                                }}
                              >
                                {spec.categoryName}
                                {spec.proficiency > 1 && (
                                  <span className="ml-0.5 opacity-60">
                                    {'*'.repeat(spec.proficiency)}
                                  </span>
                                )}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardTitle>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">
                        {stats?.itemCount || 0} items assigned
                      </span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats?.pickedUnits || 0} / {stats?.totalUnits || 0} units
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-2">
                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() =>
                        router.push(`/dispatch/bulk-picking/${batches[0]?.id}`)
                      }
                      disabled={!batches[0]}
                    >
                      <Printer className="h-3 w-3 mr-1" />
                      Print List
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => togglePickerExpand(picker.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3 mr-1" />
                      ) : (
                        <ChevronDown className="h-3 w-3 mr-1" />
                      )}
                      {pickerItems.length} items
                    </Button>
                  </div>

                  {/* Expanded item list */}
                  {isExpanded && (
                    <div className="space-y-1.5 max-h-64 overflow-auto">
                      {pickerItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No items assigned yet
                        </p>
                      ) : (
                        pickerItems.map((item) => renderItemRow(item, false))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Unassigned Items                                                   */}
      {/* ----------------------------------------------------------------- */}
      {unassignedItems.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                Unassigned Items
                <Badge variant="secondary">{unassignedItems.length}</Badge>
              </span>
              {batches.length === 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAutoAssign(batches[0].id)}
                  disabled={autoAssignLoadingBatch === batches[0].id}
                >
                  {autoAssignLoadingBatch === batches[0].id ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Wand2 className="h-3 w-3 mr-1" />
                  )}
                  Auto-Assign All
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-auto">
            {unassignedItems.map((item) => renderItemRow(item, true))}
          </CardContent>
        </Card>
      )}

      {/* All assigned, no unassigned */}
      {unassignedItems.length === 0 && totalItems > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-6 text-center">
            <Wand2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <p className="font-medium text-green-700">All items assigned</p>
            <p className="text-sm text-green-600 mt-1">
              {totalItems} items distributed across {pickers.length} pickers
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
