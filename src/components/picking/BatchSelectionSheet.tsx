'use client';

/**
 * BatchSelectionSheet - Two-Tier Allocation Batch Selection
 *
 * Used by pickers to select specific batches for Tier 1 (product-level) allocations.
 * This transitions allocations from Tier 1 to Tier 2 (batch-level).
 *
 * Features:
 * - Shows available batches for a product (sorted by FEFO)
 * - Filters by variety name and location
 * - Displays batch details: number, variety, available qty, location, age
 * - Calls fn_transition_to_batch_allocation when batch is selected
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  MapPin,
  Calendar,
  Package,
  Check,
  AlertTriangle,
  Loader2,
  Filter,
  Leaf,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getAvailableBatches,
  selectBatchForAllocation,
  type BatchCandidate,
} from '@/app/sales/allocation-actions';

export interface BatchSelectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  allocationId: string;
  productId: string;
  productName: string;
  quantityNeeded: number;
  onBatchSelected?: (result: {
    success: boolean;
    batchId?: string;
    batchNumber?: string;
    error?: string;
  }) => void;
}

export function BatchSelectionSheet({
  open,
  onOpenChange,
  orgId,
  allocationId,
  productId,
  productName,
  quantityNeeded,
  onBatchSelected,
}: BatchSelectionSheetProps) {
  // State
  const [batches, setBatches] = useState<BatchCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [varietyFilter, setVarietyFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('');

  // Derived data
  const uniqueVarieties = useMemo(() => {
    const varieties = new Set<string>();
    batches.forEach((b) => {
      if (b.varietyName) varieties.add(b.varietyName);
    });
    return Array.from(varieties).sort();
  }, [batches]);

  const uniqueLocations = useMemo(() => {
    const locations = new Map<string, string>();
    batches.forEach((b) => {
      if (b.locationId && b.locationName) {
        locations.set(b.locationId, b.locationName);
      }
    });
    return Array.from(locations.entries());
  }, [batches]);

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (varietyFilter && !b.varietyName?.toLowerCase().includes(varietyFilter.toLowerCase())) {
        return false;
      }
      if (locationFilter && b.locationId !== locationFilter) {
        return false;
      }
      return true;
    });
  }, [batches, varietyFilter, locationFilter]);

  // Fetch batches
  const fetchBatches = useCallback(async () => {
    if (!productId || !orgId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getAvailableBatches(orgId, productId);

      if (result.error) {
        setError(result.error);
        setBatches([]);
      } else {
        setBatches(result.data || []);
      }
    } catch (err) {
      setError('Failed to load available batches');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, productId]);

  // Load batches when sheet opens
  useEffect(() => {
    if (open) {
      fetchBatches();
      setVarietyFilter('');
      setLocationFilter('');
    }
  }, [open, fetchBatches]);

  // Handle batch selection
  const handleSelectBatch = async (batch: BatchCandidate) => {
    if (batch.availableQuantity < quantityNeeded) {
      setError(`Insufficient stock. Need ${quantityNeeded}, batch has ${batch.availableQuantity}`);
      return;
    }

    setSelecting(batch.batchId);
    setError(null);

    try {
      const result = await selectBatchForAllocation(allocationId, batch.batchId);

      if (result.success) {
        onBatchSelected?.({
          success: true,
          batchId: batch.batchId,
          batchNumber: batch.batchNumber,
        });
        onOpenChange(false);
      } else {
        setError(result.error || 'Failed to select batch');
        onBatchSelected?.({
          success: false,
          error: result.error,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to select batch';
      setError(errorMessage);
      onBatchSelected?.({
        success: false,
        error: errorMessage,
      });
    } finally {
      setSelecting(null);
    }
  };

  // Format age display
  const formatAge = (weeks: number): string => {
    if (weeks < 1) return 'New';
    if (weeks === 1) return '1 week';
    return `${weeks} weeks`;
  };

  // Get stock status badge variant
  const getStockBadgeVariant = (available: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (available >= quantityNeeded * 2) return 'default';
    if (available >= quantityNeeded) return 'secondary';
    return 'destructive';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Select Batch
          </SheetTitle>
          <SheetDescription>
            Choose a batch for <span className="font-medium">{productName}</span>
            <br />
            <span className="text-foreground font-medium">Need: {quantityNeeded} units</span>
          </SheetDescription>
        </SheetHeader>

        {/* Filters */}
        <div className="flex gap-2 py-4 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by variety..."
              value={varietyFilter}
              onChange={(e) => setVarietyFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          {uniqueLocations.length > 1 && (
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Locations</SelectItem>
                {uniqueLocations.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Batch List */}
        <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="font-medium">No batches available</p>
              <p className="text-sm text-muted-foreground mt-1">
                {batches.length > 0
                  ? 'Try adjusting your filters'
                  : 'No batches with available stock for this product'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBatches.map((batch) => {
                const isSelecting = selecting === batch.batchId;
                const hasSufficientStock = batch.availableQuantity >= quantityNeeded;

                return (
                  <button
                    key={batch.batchId}
                    onClick={() => handleSelectBatch(batch)}
                    disabled={isSelecting || selecting !== null}
                    className={cn(
                      'w-full text-left p-4 rounded-lg border transition-all',
                      'hover:border-primary hover:bg-accent/50',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      !hasSufficientStock && 'opacity-60 border-dashed'
                    )}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {batch.batchNumber}
                        </Badge>
                        {batch.salesStatus && batch.salesStatus !== 'available' && (
                          <Badge variant="secondary" className="text-xs">
                            {batch.salesStatus}
                          </Badge>
                        )}
                      </div>
                      <Badge variant={getStockBadgeVariant(batch.availableQuantity)}>
                        {batch.availableQuantity} avail
                      </Badge>
                    </div>

                    {/* Variety */}
                    <div className="flex items-center gap-1.5 text-sm mb-2">
                      <Leaf className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{batch.varietyName || 'Unknown variety'}</span>
                    </div>

                    {/* Details Row */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {batch.locationName && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {batch.locationName}
                        </span>
                      )}
                      {batch.ageWeeks !== null && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatAge(batch.ageWeeks)}
                        </span>
                      )}
                    </div>

                    {/* Insufficient stock warning */}
                    {!hasSufficientStock && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        Insufficient stock (need {quantityNeeded})
                      </div>
                    )}

                    {/* Loading indicator */}
                    {isSelecting && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-primary">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Selecting...
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t pt-4 flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button variant="ghost" onClick={fetchBatches} disabled={loading}>
            <Filter className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default BatchSelectionSheet;
