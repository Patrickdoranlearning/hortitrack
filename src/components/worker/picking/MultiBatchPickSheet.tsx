"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  MapPin,
  Package,
  Check,
  Loader2,
  AlertTriangle,
  Minus,
  Plus,
  Zap,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import type { PickItem } from "@/server/sales/picking";

interface AvailableBatch {
  id: string;
  batchNumber: string;
  quantity: number;
  location: string;
  status?: string;
  productName?: string;
}

interface BatchSelection {
  batchId: string;
  quantity: number;
  maxAvailable: number;
}

interface MultiBatchPickSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PickItem | null;
  pickListId: string;
  onConfirm: (
    itemId: string,
    batches: Array<{ batchId: string; quantity: number }>,
    notes?: string
  ) => Promise<void>;
  isSubmitting: boolean;
}

export function MultiBatchPickSheet({
  open,
  onOpenChange,
  item,
  pickListId,
  onConfirm,
  isSubmitting,
}: MultiBatchPickSheetProps) {
  const [batches, setBatches] = useState<AvailableBatch[]>([]);
  const [selections, setSelections] = useState<Map<string, BatchSelection>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  const targetQty = item?.targetQty || 0;

  // Fetch available batches when sheet opens
  useEffect(() => {
    if (open && item) {
      setIsLoading(true);
      fetch(
        `/api/picking/${pickListId}/items/${item.id}/batches?includePicks=true`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.batches) {
            setBatches(data.batches);
            // Auto-suggest FEFO selection
            autoSuggestSelection(data.batches, targetQty);
          }
        })
        .catch(() => {
          // Silent fail
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- autoSuggestSelection is stable via useCallback
  }, [open, item, pickListId, targetQty]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setSelections(new Map());
      setExpandedBatchId(null);
    }
  }, [open]);

  // Auto-suggest optimal batch selection using FEFO
  const autoSuggestSelection = useCallback(
    (availableBatches: AvailableBatch[], target: number) => {
      const newSelections = new Map<string, BatchSelection>();
      let remaining = target;

      for (const batch of availableBatches) {
        if (remaining <= 0) break;
        if (batch.quantity <= 0) continue;

        const pickQty = Math.min(remaining, batch.quantity);
        newSelections.set(batch.id, {
          batchId: batch.id,
          quantity: pickQty,
          maxAvailable: batch.quantity,
        });
        remaining -= pickQty;
      }

      setSelections(newSelections);
      vibrateTap();
    },
    []
  );

  // Calculate totals
  const totalSelected = useMemo(() => {
    let total = 0;
    selections.forEach((s) => {
      total += s.quantity;
    });
    return total;
  }, [selections]);

  const progress =
    targetQty > 0
      ? Math.min(100, Math.round((totalSelected / targetQty) * 100))
      : 0;
  const isShortPick = totalSelected > 0 && totalSelected < targetQty;
  const isComplete = totalSelected >= targetQty;
  const canSubmit = totalSelected > 0;

  // Toggle batch selection
  const toggleBatch = (batch: AvailableBatch) => {
    vibrateTap();
    const newSelections = new Map(selections);
    if (newSelections.has(batch.id)) {
      newSelections.delete(batch.id);
      setExpandedBatchId(null);
    } else {
      // Calculate how much we still need
      let currentTotal = 0;
      newSelections.forEach((s) => {
        currentTotal += s.quantity;
      });
      const remaining = Math.max(0, targetQty - currentTotal);
      const pickQty = Math.min(remaining, batch.quantity);

      if (pickQty > 0) {
        newSelections.set(batch.id, {
          batchId: batch.id,
          quantity: pickQty,
          maxAvailable: batch.quantity,
        });
        setExpandedBatchId(batch.id);
      }
    }
    setSelections(newSelections);
  };

  // Update quantity for a batch
  const updateQuantity = (batchId: string, quantity: number) => {
    const newSelections = new Map(selections);
    const selection = newSelections.get(batchId);
    if (selection) {
      const clampedQty = Math.max(0, Math.min(quantity, selection.maxAvailable));
      if (clampedQty === 0) {
        newSelections.delete(batchId);
        setExpandedBatchId(null);
      } else {
        newSelections.set(batchId, { ...selection, quantity: clampedQty });
      }
      setSelections(newSelections);
    }
  };

  // Increment/decrement with haptics
  const incrementQty = (batchId: string) => {
    vibrateTap();
    const selection = selections.get(batchId);
    if (selection && selection.quantity < selection.maxAvailable) {
      updateQuantity(batchId, selection.quantity + 1);
    }
  };

  const decrementQty = (batchId: string) => {
    vibrateTap();
    const selection = selections.get(batchId);
    if (selection && selection.quantity > 0) {
      updateQuantity(batchId, selection.quantity - 1);
    }
  };

  // Fill remaining from a batch
  const fillFromBatch = (batch: AvailableBatch) => {
    vibrateTap();
    let currentTotal = 0;
    selections.forEach((s) => {
      currentTotal += s.quantity;
    });
    const remaining = Math.max(0, targetQty - currentTotal);

    const newSelections = new Map(selections);
    const existing = newSelections.get(batch.id);
    const currentQty = existing?.quantity || 0;
    const additionalNeeded = Math.min(remaining, batch.quantity - currentQty);

    if (additionalNeeded > 0) {
      newSelections.set(batch.id, {
        batchId: batch.id,
        quantity: currentQty + additionalNeeded,
        maxAvailable: batch.quantity,
      });
      setSelections(newSelections);
    }
  };

  const handleConfirm = async () => {
    if (!canSubmit || !item) return;

    vibrateTap();
    const batchesArray = Array.from(selections.values()).map((s) => ({
      batchId: s.batchId,
      quantity: s.quantity,
    }));

    await onConfirm(item.id, batchesArray);
    vibrateSuccess();
  };

  if (!item) return null;

  const productName =
    item.productName || `${item.plantVariety || ""} - ${item.size || ""}`.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-hidden flex flex-col">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pick Item
          </SheetTitle>
          <SheetDescription className="truncate">
            {productName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {/* Progress Summary - Sticky */}
          <div className="sticky top-0 bg-background pt-2 pb-3 -mx-4 px-4 border-b z-10">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Selection</span>
              <span
                className={cn(
                  "font-medium text-lg",
                  isComplete && "text-green-600",
                  isShortPick && "text-amber-600"
                )}
              >
                {totalSelected} / {targetQty}
              </span>
            </div>
            <Progress
              value={progress}
              className={cn(
                "h-3",
                isComplete && "[&>div]:bg-green-500",
                isShortPick && "[&>div]:bg-amber-500"
              )}
            />
            {isShortPick && (
              <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                <AlertTriangle className="h-3 w-3" />
                {targetQty - totalSelected} units short
              </div>
            )}
          </div>

          {/* Auto-fill Button */}
          {batches.length > 0 && (
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={() => autoSuggestSelection(batches, targetQty)}
            >
              <Zap className="h-4 w-4 mr-2" />
              Auto-fill (FEFO)
            </Button>
          )}

          {/* Available Batches */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Available Batches
            </Label>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                <p className="font-medium">No batches available</p>
                <p className="text-sm text-muted-foreground">
                  There are no batches with available stock
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {batches.map((batch) => {
                  const selection = selections.get(batch.id);
                  const isSelected = !!selection;
                  const qty = selection?.quantity || 0;
                  const isExpanded = expandedBatchId === batch.id;

                  return (
                    <Card
                      key={batch.id}
                      className={cn(
                        "p-3 transition-all",
                        isSelected && "border-primary ring-1 ring-primary bg-primary/5"
                      )}
                    >
                      {/* Batch Header - Tappable */}
                      <button
                        className="w-full flex items-center gap-3 text-left min-h-[48px]"
                        onClick={() => toggleBatch(batch)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleBatch(batch)}
                          className="h-6 w-6"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-medium">
                              {batch.batchNumber}
                            </span>
                            {batch.status && (
                              <Badge variant="secondary" className="text-[10px]">
                                {batch.status}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {batch.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {batch.quantity}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="text-right">
                            <Badge
                              variant="default"
                              className={cn(
                                "text-sm px-3",
                                qty === batch.quantity && "bg-green-600"
                              )}
                            >
                              {qty}
                            </Badge>
                          </div>
                        )}
                      </button>

                      {/* Quantity Controls - Expandable */}
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t">
                          <button
                            className="w-full flex items-center justify-between text-sm text-muted-foreground mb-2"
                            onClick={() =>
                              setExpandedBatchId(isExpanded ? null : batch.id)
                            }
                          >
                            <span>Adjust quantity</span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="space-y-3">
                              {/* Stepper Controls */}
                              <div className="flex items-center justify-center gap-3">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-14 w-14"
                                  onClick={() => decrementQty(batch.id)}
                                  disabled={qty <= 1}
                                >
                                  <Minus className="h-5 w-5" />
                                </Button>
                                <Input
                                  type="number"
                                  value={qty}
                                  onChange={(e) =>
                                    updateQuantity(
                                      batch.id,
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="h-14 w-24 text-center text-xl font-medium"
                                  min={1}
                                  max={batch.quantity}
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-14 w-14"
                                  onClick={() => incrementQty(batch.id)}
                                  disabled={qty >= batch.quantity}
                                >
                                  <Plus className="h-5 w-5" />
                                </Button>
                              </div>

                              {/* Quick Actions */}
                              <div className="flex gap-2">
                                <Button
                                  variant="secondary"
                                  className="flex-1 h-11"
                                  onClick={() =>
                                    updateQuantity(batch.id, batch.quantity)
                                  }
                                  disabled={qty === batch.quantity}
                                >
                                  Max ({batch.quantity})
                                </Button>
                                {!isComplete && qty < batch.quantity && (
                                  <Button
                                    variant="secondary"
                                    className="flex-1 h-11"
                                    onClick={() => fillFromBatch(batch)}
                                  >
                                    Fill Remaining
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Fixed Bottom Action */}
        <div className="border-t pt-4 pb-safe">
          <Button
            size="lg"
            className={cn(
              "w-full h-14 text-lg gap-2",
              isComplete && "bg-green-600 hover:bg-green-700",
              isShortPick && "bg-amber-600 hover:bg-amber-700"
            )}
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            {isShortPick
              ? `Confirm Short Pick (${totalSelected})`
              : `Confirm Pick (${totalSelected})`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
