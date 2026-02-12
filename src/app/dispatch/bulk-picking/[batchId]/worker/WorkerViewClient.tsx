'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Loader2,
  PartyPopper,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface WorkerPickItem {
  id: string;
  skuId: string;
  skuCode: string;
  productName: string;
  size: string;
  totalQty: number;
  pickedQty: number;
  status: 'pending' | 'picked' | 'short' | 'substituted';
  locationHint: string | null;
  sizeCategoryName: string | null;
  sizeCategoryColor: string | null;
}

interface WorkerViewData {
  batchId: string;
  batchNumber: string;
  batchDate: string;
  batchStatus: string;
  pickerName: string;
  categories: string[];
  items: WorkerPickItem[];
}

interface WorkerViewClientProps {
  data: WorkerViewData;
}

export default function WorkerViewClient({ data }: WorkerViewClientProps) {
  const [items, setItems] = useState<WorkerPickItem[]>(data.items);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const pickedUnits = items.reduce((sum, i) => sum + i.pickedQty, 0);
  const totalUnits = items.reduce((sum, i) => sum + i.totalQty, 0);
  const progressPercent = totalUnits > 0 ? Math.round((pickedUnits / totalUnits) * 100) : 0;

  const pendingItems = items.filter((i) => i.status === 'pending');
  const completedItems = items.filter((i) => i.status !== 'pending');
  const allComplete = pendingItems.length === 0 && items.length > 0;

  const handlePickItem = useCallback(async (item: WorkerPickItem) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bulk-picking/${data.batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pick_item',
          itemId: item.id,
          pickedQty: item.totalQty,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to pick item');
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'picked' as const, pickedQty: item.totalQty }
            : i
        )
      );

      toast.success(`${item.productName} picked - ${item.totalQty} units`);
    } catch (error) {
      toast.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [data.batchId]);

  const handleShortItem = useCallback(async (item: WorkerPickItem) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bulk-picking/${data.batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'short_item',
          itemId: item.id,
          pickedQty: 0,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to mark short');
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'short' as const, pickedQty: 0 }
            : i
        )
      );

      toast.warning(`${item.productName} marked as short`);
    } catch (error) {
      toast.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [data.batchId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/bulk-picking/${data.batchId}`);
      if (!res.ok) throw new Error('Failed to refresh');
      const json = await res.json();
      // The GET endpoint returns all items; filter to only current user's items
      // We filter by matching item IDs since we already know which items belong to this picker
      const myItemIds = new Set(data.items.map((i) => i.id));
      const refreshedItems: WorkerPickItem[] = (json.batch?.items || [])
        .filter((i: { id: string }) => myItemIds.has(i.id))
        .map((i: Record<string, unknown>) => ({
          id: i.id as string,
          skuId: i.skuId as string,
          skuCode: (i.skuCode as string) || '',
          productName: (i.productName as string) || 'Unknown',
          size: (i.size as string) || '',
          totalQty: i.totalQty as number,
          pickedQty: i.pickedQty as number,
          status: i.status as WorkerPickItem['status'],
          locationHint: (i.locationHint as string) || null,
          sizeCategoryName: null,
          sizeCategoryColor: null,
        }));

      if (refreshedItems.length > 0) {
        setItems(refreshedItems);
      }
      toast.success('Refreshed');
    } catch (error) {
      toast.error(error);
    } finally {
      setRefreshing(false);
    }
  }, [data.batchId, data.items]);

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-lg px-4 py-4 pb-8 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">Your Picks Today</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data.batchNumber}
              {data.categories.length > 0 && (
                <span> &middot; {data.categories.join(', ')}</span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </div>

        {/* Picker Name */}
        <p className="text-sm font-medium text-muted-foreground">
          Picker: {data.pickerName}
        </p>

        {/* Progress */}
        <Card>
          <CardContent className="py-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">
                {progressPercent}% complete
              </span>
              <span className="text-sm text-muted-foreground">
                {pickedUnits}/{totalUnits} units
              </span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </CardContent>
        </Card>

        {/* All Complete State */}
        {allComplete && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="py-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-3">
                <PartyPopper className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-green-700">All Done!</h2>
              <p className="text-sm text-green-600 mt-1">
                All your items have been picked. Return to the packing station.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base">{item.productName}</p>
                      <p className="text-sm text-muted-foreground">{item.size}</p>
                      {item.locationHint && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {item.locationHint}
                        </p>
                      )}
                      {item.sizeCategoryName && (
                        <Badge
                          variant="outline"
                          className="text-xs mt-1"
                          style={{ borderColor: item.sizeCategoryColor || undefined }}
                        >
                          {item.sizeCategoryName}
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xl px-4 py-2 font-bold shrink-0">
                      x{item.totalQty}
                    </Badge>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="lg"
                      onClick={() => handlePickItem(item)}
                      disabled={isLoading}
                      className="flex-1 h-12 text-base"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                      )}
                      Pick All
                    </Button>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={() => handleShortItem(item)}
                      disabled={isLoading}
                      className="h-12 px-4"
                    >
                      <AlertTriangle className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Completed Items */}
        {completedItems.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Completed ({completedItems.length})
            </h3>
            {completedItems.map((item) => (
              <Card
                key={item.id}
                className={cn(
                  'opacity-75',
                  item.status === 'short' && 'border-red-200 bg-red-50'
                )}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.status === 'short' ? (
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.size}</p>
                      </div>
                    </div>
                    <Badge variant={item.status === 'short' ? 'destructive' : 'secondary'}>
                      {item.pickedQty}/{item.totalQty}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {items.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No items assigned to you in this batch.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
