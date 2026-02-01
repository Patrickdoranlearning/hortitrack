"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertTriangle,
  Package,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  Calendar,
  WifiOff,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { vibrateSuccess, vibrateTap, vibrateError, vibrateWarning } from "@/lib/haptics";
import { PickItemDialog } from "@/components/worker/picking/PickItemDialog";
import { PickingBatchSelector } from "@/components/worker/picking/PickingBatchSelector";
import { PickingItemCard } from "@/components/worker/picking/PickingItemCard";
import { PickingTrolleyStep, type TrolleyInfo } from "@/components/worker/picking/PickingTrolleyStep";
import type { SaleLabelItem } from "@/components/worker/picking/SaleLabelPrintSheet";
import type { PickList, PickItem } from "@/server/sales/picking";

interface PickingDetailPageProps {
  params: Promise<{ pickListId: string }>;
}

export default function PickingDetailPage({ params }: PickingDetailPageProps) {
  const { pickListId } = use(params);
  const router = useRouter();

  const [pickList, setPickList] = useState<PickList | null>(null);
  const [items, setItems] = useState<PickItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PickItem | null>(null);
  const [showBatchSelector, setShowBatchSelector] = useState(false);
  const [showTrolleyStep, setShowTrolleyStep] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Track online status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch pick list and items
  const fetchData = useCallback(async () => {
    try {
      const [pickListRes, itemsRes] = await Promise.all([
        fetch(`/api/picking/${pickListId}`),
        fetch(`/api/picking/${pickListId}/items`),
      ]);

      if (!pickListRes.ok) {
        const err = await pickListRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch pick list");
      }

      const pickListData = await pickListRes.json();
      const itemsData = await itemsRes.json();

      setPickList(pickListData.pickList);
      setItems(itemsData.items || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load pick list";
      setError(message);
    }
  }, [pickListId]);

  // Initial fetch
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    load();
  }, [fetchData]);

  // Auto-start pick list if pending
  useEffect(() => {
    if (pickList?.status === "pending" && isOnline) {
      fetch(`/api/picking/${pickListId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      }).then(() => {
        setPickList((prev) => (prev ? { ...prev, status: "in_progress" } : null));
      });
    }
  }, [pickList?.status, pickListId, isOnline]);

  // Refresh items
  const refreshItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/picking/${pickListId}/items`);
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch {
      // Silent fail on refresh
    }
  }, [pickListId]);

  // Handle picking an item
  const handlePickItem = async (
    itemId: string,
    pickedQty: number,
    batchId?: string,
    status?: string
  ) => {
    setIsSubmitting(true);
    vibrateTap();

    try {
      const res = await fetch(`/api/picking/${pickListId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickItemId: itemId,
          pickedQty,
          pickedBatchId: batchId,
          status,
        }),
      });

      const data = await res.json();

      if (data.error) {
        vibrateError();
        setError(data.error);
        return;
      }

      if (data.items) {
        setItems(data.items);
      }

      vibrateSuccess();
      setSelectedItem(null);
    } catch {
      vibrateError();
      setError("Failed to pick item");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle multi-batch picking
  const handleMultiBatchPick = async (batches: Array<{ batchId: string; quantity: number }>) => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    vibrateTap();

    try {
      const res = await fetch(`/api/picking/${pickListId}/items/${selectedItem.id}/batches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batches }),
      });

      const data = await res.json();

      if (data.error) {
        vibrateError();
        setError(data.error);
        return;
      }

      // Refresh items to get updated batch picks
      await refreshItems();

      vibrateSuccess();
      setSelectedItem(null);
      setShowBatchSelector(false);
    } catch {
      vibrateError();
      setError("Failed to pick item");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle selecting an item - now opens batch selector by default
  const handleSelectItem = (item: PickItem) => {
    vibrateTap();
    setSelectedItem(item);
    setShowBatchSelector(true);
  };

  // Handle completing the pick list (with trolley info)
  const handleCompletePicking = async (trolleyInfo?: TrolleyInfo) => {
    setIsSubmitting(true);
    vibrateWarning();

    try {
      const res = await fetch(`/api/picking/${pickListId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          trolleyInfo: trolleyInfo,
        }),
      });

      const data = await res.json();

      if (data.error) {
        vibrateError();
        setError(data.error);
        return;
      }

      vibrateSuccess();
      router.push("/worker/picking");
    } catch {
      vibrateError();
      setError("Failed to complete picking");
    } finally {
      setIsSubmitting(false);
      setCompleteDialogOpen(false);
      setShowTrolleyStep(false);
    }
  };

  // Open trolley step when ready to complete
  const handleOpenTrolleyStep = () => {
    vibrateTap();
    setShowTrolleyStep(true);
  };

  const pendingItems = items.filter((i) => i.status === "pending");
  const completedItems = items.filter((i) => i.status !== "pending");
  const totalItems = items.length;
  const pickedCount = completedItems.length;
  const progress = totalItems > 0 ? Math.round((pickedCount / totalItems) * 100) : 0;
  const totalQty = items.reduce((sum, i) => sum + i.targetQty, 0);
  const pickedQty = items.reduce((sum, i) => sum + i.pickedQty, 0);
  const canComplete = pendingItems.length === 0;
  const hasShorts = completedItems.some((i) => i.status === "short");

  // Convert picked items to label items for printing (only items with price)
  const labelItems: SaleLabelItem[] = completedItems
    .filter((item) => item.pickedQty > 0 && item.unitPriceExVat != null)
    .map((item) => ({
      productName: item.productName || item.plantVariety || "Unknown",
      size: item.size || "",
      price: item.unitPriceExVat || 0,
      quantity: item.pickedQty,
      batchNumber: item.pickedBatchNumber || item.originalBatchNumber,
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !pickList) {
    return (
      <div className="px-4 py-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => router.back()} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Offline Notice */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span>You are offline. Changes will sync when connected.</span>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/worker/picking")}
            className="min-h-[44px] min-w-[44px] shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">
              Order #{pickList?.orderNumber || pickListId.slice(0, 8)}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {pickList?.customerName}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={refreshItems}
            disabled={!isOnline}
            className="min-h-[44px] min-w-[44px] shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Delivery date */}
        {pickList?.requestedDeliveryDate && (
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Due: {format(parseISO(pickList.requestedDeliveryDate), "EEE, MMM d")}
            </span>
          </div>
        )}
      </div>

      {/* Progress Card */}
      <div className="px-4 py-4">
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
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-auto p-1"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Items to Pick */}
      <div className="px-4 space-y-3">
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
              <PickingItemCard
                key={item.id}
                item={item}
                onSelect={handleSelectItem}
                showProgress={true}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Items */}
      {completedItems.length > 0 && (
        <div className="px-4 mt-6 space-y-3">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between py-2 touch-manipulation"
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
                <PickingItemCard
                  key={item.id}
                  item={item}
                  onSelect={() => {}} // View only for completed items
                  showProgress={true}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fixed Bottom Action Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-40"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        {/* Progress bar for trolley loading when complete */}
        {canComplete && (
          <div className="max-w-4xl mx-auto mb-3">
            <Progress value={progress} className="h-2 [&>div]:bg-green-500" />
          </div>
        )}
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="text-sm">
            <span className="font-medium">{pickedCount}/{totalItems}</span>
            <span className="text-muted-foreground"> items picked</span>
            {canComplete && (
              <span className="text-green-600 ml-2">({pickedQty} units)</span>
            )}
          </div>
          <Button
            size="lg"
            disabled={!canComplete || isSubmitting || !isOnline}
            onClick={handleOpenTrolleyStep}
            className={cn(
              "gap-2 min-h-[48px]",
              canComplete && "bg-green-600 hover:bg-green-700"
            )}
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            FINISH & STAGE
          </Button>
        </div>
      </div>

      {/* Multi-Batch Picker Sheet */}
      <PickingBatchSelector
        open={showBatchSelector && !!selectedItem}
        onOpenChange={(open) => {
          setShowBatchSelector(open);
          if (!open) setSelectedItem(null);
        }}
        pickListId={pickListId}
        itemId={selectedItem?.id || ""}
        productName={selectedItem?.productName || `${selectedItem?.plantVariety || ""} ${selectedItem?.size || ""}`.trim()}
        targetQty={selectedItem?.targetQty || 0}
        currentPicks={selectedItem?.batchPicks || []}
        onSave={handleMultiBatchPick}
        isSubmitting={isSubmitting}
      />

      {/* Legacy Pick Item Dialog (fallback) */}
      <PickItemDialog
        open={!!selectedItem && !showBatchSelector}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        item={selectedItem}
        pickListId={pickListId}
        onPick={handlePickItem}
        onMultiBatchPick={async (_itemId, batches, _notes) => {
          await handleMultiBatchPick(batches);
        }}
        isSubmitting={isSubmitting}
      />

      {/* Trolley Assignment Step */}
      <PickingTrolleyStep
        open={showTrolleyStep}
        onOpenChange={setShowTrolleyStep}
        orderNumber={pickList?.orderNumber || pickListId.slice(0, 8)}
        customerName={pickList?.customerName || ""}
        totalUnits={pickedQty}
        onComplete={handleCompletePicking}
        isSubmitting={isSubmitting}
        labelItems={labelItems}
      />

      {/* Complete Confirmation Dialog (legacy fallback) */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Picking?</AlertDialogTitle>
            <AlertDialogDescription>
              {hasShorts ? (
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
            <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleCompletePicking()}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 min-h-[44px]"
            >
              {isSubmitting ? "Completing..." : "Complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
