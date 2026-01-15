'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Package,
  Layers,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PickItem } from '@/server/sales/picking';

type ExtendedPickItem = PickItem & {
  orderNumber?: string;
  customerName?: string;
};

interface CombinedPickingClientProps {
  initialItems: ExtendedPickItem[];
  pickLists: { id: string; orderNumber?: string; customerName?: string }[];
}

// Group items by location, then by product (variety + size)
interface AggregatedItem {
  key: string; // location-variety-size
  location: string;
  plantVariety: string;
  size: string;
  totalQty: number;
  pickedQty: number;
  items: ExtendedPickItem[]; // Individual items from different orders
}

interface LocationGroup {
  location: string;
  aggregatedItems: AggregatedItem[];
  totalQty: number;
  pickedQty: number;
}

export default function CombinedPickingClient({
  initialItems,
  pickLists,
}: CombinedPickingClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [items, setItems] = useState<ExtendedPickItem[]>(initialItems);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedAggregation, setSelectedAggregation] = useState<AggregatedItem | null>(null);
  const [confirmQty, setConfirmQty] = useState<number>(0);

  // Aggregate items by location -> product
  const locationGroups = useMemo(() => {
    const pendingItems = items.filter(i => i.status === 'pending');

    // Group by location -> variety+size
    const locationMap = new Map<string, Map<string, AggregatedItem>>();

    for (const item of pendingItems) {
      const location = item.batchLocation || 'Unknown Location';
      const productKey = `${item.plantVariety || 'Unknown'}-${item.size || ''}`;

      if (!locationMap.has(location)) {
        locationMap.set(location, new Map());
      }

      const productMap = locationMap.get(location)!;

      if (!productMap.has(productKey)) {
        productMap.set(productKey, {
          key: `${location}-${productKey}`,
          location,
          plantVariety: item.plantVariety || 'Unknown',
          size: item.size || '',
          totalQty: 0,
          pickedQty: 0,
          items: [],
        });
      }

      const agg = productMap.get(productKey)!;
      agg.totalQty += item.targetQty;
      agg.pickedQty += item.pickedQty;
      agg.items.push(item);
    }

    // Convert to array and sort by location
    const groups: LocationGroup[] = [];

    locationMap.forEach((productMap, location) => {
      const aggregatedItems = Array.from(productMap.values())
        .sort((a, b) => a.plantVariety.localeCompare(b.plantVariety));

      const totalQty = aggregatedItems.reduce((sum, a) => sum + a.totalQty, 0);
      const pickedQty = aggregatedItems.reduce((sum, a) => sum + a.pickedQty, 0);

      groups.push({
        location,
        aggregatedItems,
        totalQty,
        pickedQty,
      });
    });

    // Sort locations alphabetically, but put "Unknown Location" last
    return groups.sort((a, b) => {
      if (a.location === 'Unknown Location') return 1;
      if (b.location === 'Unknown Location') return -1;
      return a.location.localeCompare(b.location);
    });
  }, [items]);

  // Calculate overall progress
  const progress = useMemo(() => {
    const total = items.length;
    const picked = items.filter(i => i.status !== 'pending').length;
    return { total, picked, percent: total > 0 ? Math.round((picked / total) * 100) : 0 };
  }, [items]);

  const toggleLocation = (location: string) => {
    const next = new Set(expandedLocations);
    if (next.has(location)) {
      next.delete(location);
    } else {
      next.add(location);
    }
    setExpandedLocations(next);
  };

  const handleOpenConfirm = (agg: AggregatedItem) => {
    setSelectedAggregation(agg);
    setConfirmQty(agg.totalQty - agg.pickedQty);
    setConfirmDialogOpen(true);
  };

  const handleConfirmPick = useCallback(async () => {
    if (!selectedAggregation) return;

    setIsSubmitting(true);

    try {
      // Pick items in order until we've fulfilled the confirmed quantity
      let remaining = confirmQty;
      const updates: { itemId: string; pickedQty: number; pickListId: string }[] = [];

      for (const item of selectedAggregation.items) {
        if (remaining <= 0) break;

        const itemRemaining = item.targetQty - item.pickedQty;
        if (itemRemaining <= 0) continue;

        const toPick = Math.min(itemRemaining, remaining);
        updates.push({
          itemId: item.id,
          pickedQty: item.pickedQty + toPick,
          pickListId: item.pickListId,
        });
        remaining -= toPick;
      }

      // Send updates to the server
      for (const update of updates) {
        const res = await fetch(`/api/picking/${update.pickListId}/items`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickItemId: update.itemId,
            pickedQty: update.pickedQty,
          }),
        });

        const data = await res.json();

        if (data.error) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: data.error,
          });
          return;
        }
      }

      // Update local state
      setItems(prev => {
        const next = [...prev];
        for (const update of updates) {
          const idx = next.findIndex(i => i.id === update.itemId);
          if (idx !== -1) {
            const item = next[idx];
            const newPickedQty = update.pickedQty;
            next[idx] = {
              ...item,
              pickedQty: newPickedQty,
              status: newPickedQty >= item.targetQty ? 'picked' : item.status,
            };
          }
        }
        return next;
      });

      toast({
        title: 'Items Picked',
        description: `Picked ${confirmQty} x ${selectedAggregation.plantVariety}`,
      });

      setConfirmDialogOpen(false);
      setSelectedAggregation(null);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to confirm pick',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedAggregation, confirmQty, toast]);

  const handleFinish = () => {
    router.push('/dispatch/picker');
  };

  const allComplete = progress.picked === progress.total;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dispatch/picker')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Combined Picking
            </h1>
            <p className="text-sm text-muted-foreground">
              {pickLists.length} orders combined
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {progress.picked} / {progress.total}
        </Badge>
      </div>

      {/* Orders Summary */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Orders in this pick</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {pickLists.map(pl => (
              <Badge key={pl.id} variant="secondary" className="text-xs">
                #{pl.orderNumber || pl.id.slice(0, 8)} - {pl.customerName || 'Unknown'}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Overall Progress</span>
          <span className="font-medium">{progress.percent}%</span>
        </div>
        <Progress value={progress.percent} className="h-2" />
      </div>

      {/* All complete message */}
      {allComplete && (
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-300">All items picked!</p>
                <p className="text-sm text-green-600 dark:text-green-400">Ready to proceed to packing</p>
              </div>
            </div>
            <Button onClick={handleFinish}>
              Return to Queue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Location Groups */}
      <div className="space-y-3">
        {locationGroups.map(group => (
          <Card key={group.location} className="overflow-hidden">
            <button
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
              onClick={() => toggleLocation(group.location)}
            >
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-medium">{group.location}</p>
                  <p className="text-sm text-muted-foreground">
                    {group.aggregatedItems.length} products, {group.totalQty} units
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={group.pickedQty === group.totalQty ? "default" : "secondary"}>
                  {group.pickedQty}/{group.totalQty}
                </Badge>
                {expandedLocations.has(group.location) ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>

            {expandedLocations.has(group.location) && (
              <div className="border-t divide-y">
                {group.aggregatedItems.map(agg => {
                  const remaining = agg.totalQty - agg.pickedQty;
                  const isComplete = remaining <= 0;

                  return (
                    <div
                      key={agg.key}
                      className={cn(
                        "p-4 flex items-center justify-between gap-4",
                        isComplete && "bg-green-50/50 dark:bg-green-950/30"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isComplete ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className={cn("font-medium truncate", isComplete && "text-green-700 dark:text-green-300")}>
                            {agg.plantVariety}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {agg.size && <span>{agg.size} • </span>}
                            {agg.items.length > 1 ? (
                              <span className="text-xs">
                                ({agg.items.map(i => `#${i.orderNumber || i.pickListId.slice(0,4)}: ${i.targetQty}`).join(', ')})
                              </span>
                            ) : (
                              <span className="text-xs">Order #{agg.items[0]?.orderNumber || 'N/A'}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className={cn("font-bold text-lg", isComplete ? "text-green-600" : "")}>
                            {isComplete ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" />
                                Done
                              </span>
                            ) : (
                              `${remaining}`
                            )}
                          </p>
                          {!isComplete && (
                            <p className="text-xs text-muted-foreground">to pick</p>
                          )}
                        </div>
                        {!isComplete && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenConfirm(agg)}
                          >
                            Pick
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ))}

        {locationGroups.length === 0 && !allComplete && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No pending items to pick</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirm Pick Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Pick</DialogTitle>
            <DialogDescription>
              {selectedAggregation && (
                <>
                  Picking <strong>{selectedAggregation.plantVariety}</strong>
                  {selectedAggregation.size && <> ({selectedAggregation.size})</>}
                  {' '}from <strong>{selectedAggregation.location}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedAggregation && (
            <div className="space-y-4">
              {/* Order breakdown */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">Order breakdown:</p>
                {selectedAggregation.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>#{item.orderNumber || item.pickListId.slice(0, 6)}</span>
                    <span className="font-mono">{item.targetQty - item.pickedQty} units</span>
                  </div>
                ))}
              </div>

              {/* Quantity input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity to pick</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={selectedAggregation.totalQty - selectedAggregation.pickedQty}
                    value={confirmQty}
                    onChange={(e) => setConfirmQty(parseInt(e.target.value) || 0)}
                    className="text-center text-lg font-mono"
                  />
                  <span className="text-muted-foreground">
                    / {selectedAggregation.totalQty - selectedAggregation.pickedQty}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPick}
              disabled={isSubmitting || confirmQty <= 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm {confirmQty}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
