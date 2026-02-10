'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/lib/toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertTriangle,
  Package,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PickItemCard from '@/components/sales/PickItemCard';
import BatchSubstitutionDialog from '@/components/sales/BatchSubstitutionDialog';
import type { PickList, PickItem } from '@/server/sales/picking';

interface PickingWorkflowClientProps {
  pickList: PickList;
  initialItems: PickItem[];
}

export default function PickingWorkflowClient({
  pickList,
  initialItems,
}: PickingWorkflowClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<PickItem[]>(initialItems);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [substitutionDialogOpen, setSubstitutionDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const pendingItems = items.filter(i => i.status === 'pending');
  const completedItems = items.filter(i => i.status !== 'pending');
  const totalItems = items.length;
  const pickedCount = completedItems.length;
  const progress = totalItems > 0 ? Math.round((pickedCount / totalItems) * 100) : 0;

  const totalQty = items.reduce((sum, i) => sum + i.targetQty, 0);
  const pickedQty = items.reduce((sum, i) => sum + i.pickedQty, 0);

  const selectedItem = selectedItemId ? items.find(i => i.id === selectedItemId) : null;

  // Start the pick list if it's pending
  useEffect(() => {
    if (pickList.status === 'pending') {
      fetch(`/api/picking/${pickList.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
    }
  }, [pickList.id, pickList.status]);

  const refreshItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/picking/${pickList.id}/items`);
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch {
      // Item refresh failed silently
    }
  }, [pickList.id]);

  const handlePickItem = async (itemId: string, pickedQty: number, batchId?: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/picking/${pickList.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickItemId: itemId,
          pickedQty,
          pickedBatchId: batchId,
        }),
      });

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.items) {
        setItems(data.items);
      }

      toast.success(`Picked ${pickedQty} units`);
    } catch {
      toast.error('Failed to pick item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubstitute = (itemId: string) => {
    setSelectedItemId(itemId);
    setSubstitutionDialogOpen(true);
  };

  const handleSubstitutionConfirm = async (batchId: string, reason: string) => {
    if (!selectedItemId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/picking/${pickList.id}/items/${selectedItemId}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, reason }),
      });

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      await refreshItems();
      setSubstitutionDialogOpen(false);
      setSelectedItemId(null);

      toast.success('The batch has been changed');
    } catch {
      toast.error('Failed to substitute batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle multi-batch pick (new default flow)
  const handleMultiBatchPick = async (
    itemId: string,
    batches: Array<{ batchId: string; quantity: number }>,
    notes?: string
  ) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/picking/${pickList.id}/items/${itemId}/batches`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batches, notes }),
      });

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      await refreshItems();

      const totalPicked = batches.reduce((sum, b) => sum + b.quantity, 0);
      toast.success(`Picked ${totalPicked} units from ${batches.length} batch${batches.length > 1 ? 'es' : ''}`);
    } catch {
      toast.error('Failed to pick item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompletePicking = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/picking/${pickList.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success('Picking complete! Order is ready for dispatch');

      router.push('/sales/picking');
    } catch {
      toast.error('Failed to complete picking');
    } finally {
      setIsSubmitting(false);
      setCompleteDialogOpen(false);
    }
  };

  const canComplete = pendingItems.length === 0;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/sales/picking')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">
            Order #{pickList.orderNumber || pickList.orderId.slice(0, 8)}
          </h1>
          <p className="text-muted-foreground truncate">
            {pickList.customerName}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={refreshItems}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress Card */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Picking Progress</span>
          <span className="text-sm text-muted-foreground">
            {pickedCount} / {totalItems} items
          </span>
        </div>
        <Progress value={progress} className="h-3" />
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{pickedQty} / {totalQty} units picked</span>
          <span>{progress}% complete</span>
        </div>
      </Card>

      {/* Pending Items */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Items to Pick
          <Badge variant="secondary">{pendingItems.length}</Badge>
        </h2>

        {pendingItems.length === 0 ? (
          <Card className="p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium">All items picked!</p>
            <p className="text-muted-foreground">Ready to complete this pick list</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <PickItemCard
                key={item.id}
                item={item}
                pickListId={pickList.id}
                onPick={handlePickItem}
                onMultiBatchPick={handleMultiBatchPick}
                onSubstitute={handleSubstitute}
                isSubmitting={isSubmitting}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Items (Collapsible) */}
      {completedItems.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between py-2 text-left"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Completed Items
              <Badge variant="outline" className="text-green-600">
                {completedItems.length}
              </Badge>
            </h2>
            {showCompleted ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {showCompleted && (
            <div className="space-y-3 opacity-75">
              {completedItems.map((item) => (
                <PickItemCard
                  key={item.id}
                  item={item}
                  pickListId={pickList.id}
                  onPick={handlePickItem}
                  onMultiBatchPick={handleMultiBatchPick}
                  onSubstitute={handleSubstitute}
                  isSubmitting={isSubmitting}
                  readonly
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 safe-area-pb">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="text-sm">
            <span className="font-medium">{pickedCount}/{totalItems}</span>
            <span className="text-muted-foreground"> items picked</span>
          </div>
          <Button
            size="lg"
            disabled={!canComplete || isSubmitting}
            onClick={() => setCompleteDialogOpen(true)}
            className={cn(
              'gap-2',
              canComplete && 'bg-green-600 hover:bg-green-700'
            )}
          >
            <Check className="h-5 w-5" />
            Complete Picking
          </Button>
        </div>
      </div>

      {/* Batch Substitution Dialog */}
      {selectedItem && (
        <BatchSubstitutionDialog
          open={substitutionDialogOpen}
          onOpenChange={setSubstitutionDialogOpen}
          pickItemId={selectedItem.id}
          pickListId={pickList.id}
          currentBatchNumber={selectedItem.originalBatchNumber || selectedItem.pickedBatchNumber}
          productName={selectedItem.productName || `${selectedItem.plantVariety} - ${selectedItem.size}`}
          onConfirm={handleSubstitutionConfirm}
        />
      )}

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Picking?</AlertDialogTitle>
            <AlertDialogDescription>
              {completedItems.some(i => i.status === 'short') ? (
                <span className="flex items-start gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  Some items were marked as short. The order will proceed with partial fulfillment.
                </span>
              ) : (
                `All ${totalItems} items have been picked. The order will be marked ready for dispatch.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompletePicking}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? 'Completing...' : 'Complete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

