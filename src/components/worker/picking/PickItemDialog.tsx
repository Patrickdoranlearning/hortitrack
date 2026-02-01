"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  Minus,
  Plus,
  AlertTriangle,
  RefreshCw,
  Package,
  MapPin,
  ScanLine,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateWarning, vibrateSuccess } from "@/lib/haptics";
import type { PickItem } from "@/server/sales/picking";
import { MultiBatchPickSheet } from "./MultiBatchPickSheet";
import { BatchSubstitutionSheet } from "./BatchSubstitutionSheet";

interface PickItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PickItem | null;
  pickListId: string;
  onPick: (
    itemId: string,
    pickedQty: number,
    batchId?: string,
    status?: string
  ) => Promise<void>;
  onMultiBatchPick: (
    itemId: string,
    batches: Array<{ batchId: string; quantity: number }>,
    notes?: string
  ) => Promise<void>;
  isSubmitting: boolean;
}

interface AvailableBatch {
  id: string;
  batchNumber: string;
  quantity: number;
  location: string;
  status?: string;
  productName?: string;
}

export function PickItemDialog({
  open,
  onOpenChange,
  item,
  pickListId,
  onPick,
  onMultiBatchPick,
  isSubmitting,
}: PickItemDialogProps) {
  const [qty, setQty] = useState(0);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [availableBatches, setAvailableBatches] = useState<AvailableBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [showBatchSelection, setShowBatchSelection] = useState(false);
  const [showMultiBatchSheet, setShowMultiBatchSheet] = useState(false);
  const [showSubstitutionSheet, setShowSubstitutionSheet] = useState(false);

  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setQty(item.targetQty);
      setSelectedBatchId(item.originalBatchId || item.pickedBatchId || null);
      setShowBatchSelection(false);
      setAvailableBatches([]);
    }
  }, [item]);

  // Fetch available batches for substitution
  const fetchAvailableBatches = async () => {
    if (!item) return;

    setLoadingBatches(true);
    try {
      const res = await fetch(`/api/picking/${pickListId}/items/${item.id}/batches`);
      const data = await res.json();
      if (data.batches) {
        setAvailableBatches(data.batches);
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleShowBatchSelection = () => {
    vibrateTap();
    setShowBatchSelection(true);
    fetchAvailableBatches();
  };

  const handleSelectBatch = (batch: AvailableBatch) => {
    vibrateTap();
    setSelectedBatchId(batch.id);
    setShowBatchSelection(false);
  };

  const incrementQty = () => {
    vibrateTap();
    setQty((q) => Math.min(q + 1, item?.targetQty || 0));
  };

  const decrementQty = () => {
    vibrateTap();
    setQty((q) => Math.max(q - 1, 0));
  };

  const handleFullPick = async () => {
    if (!item) return;
    vibrateTap();
    await onPick(item.id, item.targetQty, selectedBatchId || item.originalBatchId || undefined);
  };

  const handlePartialPick = async () => {
    if (!item) return;
    vibrateTap();
    const status = qty < item.targetQty ? "short" : undefined;
    await onPick(item.id, qty, selectedBatchId || item.originalBatchId || undefined, status);
  };

  const handleMarkShort = async () => {
    if (!item) return;
    vibrateWarning();
    await onPick(item.id, 0, undefined, "short");
  };

  // Open multi-batch sheet as default pick action
  const handleOpenMultiBatch = () => {
    vibrateTap();
    setShowMultiBatchSheet(true);
  };

  // Handle multi-batch pick confirmation
  const handleMultiBatchConfirm = async (
    itemId: string,
    batches: Array<{ batchId: string; quantity: number }>,
    notes?: string
  ) => {
    await onMultiBatchPick(itemId, batches, notes);
    setShowMultiBatchSheet(false);
    onOpenChange(false);
    vibrateSuccess();
  };

  // Handle batch substitution confirmation
  const handleSubstitutionConfirm = async (batchId: string, reason: string) => {
    // Update selected batch and close sheet
    setSelectedBatchId(batchId);
    setShowSubstitutionSheet(false);
    // Note: The actual substitution is recorded when picking is completed
    // The reason is captured for audit trail
    vibrateSuccess();
  };

  // Open full substitution wizard
  const handleOpenSubstitution = () => {
    vibrateTap();
    setShowSubstitutionSheet(true);
  };

  if (!item) return null;

  const productName = item.productName || `${item.plantVariety || ""} - ${item.size || ""}`.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Pick Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <h3 className="font-semibold text-lg truncate">{productName}</h3>
            {item.plantVariety && item.size && (
              <p className="text-sm text-muted-foreground">
                {item.plantVariety} - {item.size}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{item.targetQty}</span>
                <span className="text-sm text-muted-foreground">needed</span>
              </div>
              {item.batchLocation && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{item.batchLocation}</span>
                </div>
              )}
            </div>
          </div>

          {/* Current Batch */}
          {(item.originalBatchNumber || selectedBatchId) && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Batch:</span>
                <Badge variant="outline" className="font-mono">
                  {item.originalBatchNumber || "Selected"}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShowBatchSelection}
                className="text-blue-600"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Change
              </Button>
            </div>
          )}

          {/* Batch Selection */}
          {showBatchSelection && (
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Select Batch</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBatchSelection(false)}
                >
                  Cancel
                </Button>
              </div>

              {loadingBatches ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : availableBatches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No alternative batches available
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableBatches.map((batch) => (
                    <button
                      key={batch.id}
                      onClick={() => handleSelectBatch(batch)}
                      className={cn(
                        "w-full p-3 rounded-lg border text-left transition-colors",
                        "hover:bg-muted/50 active:bg-muted",
                        selectedBatchId === batch.id && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="font-mono">
                          {batch.batchNumber}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {batch.quantity} available
                        </span>
                      </div>
                      {batch.location && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {batch.location}
                        </div>
                      )}
                      {batch.productName && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {batch.productName}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full mt-2"
                disabled
              >
                <ScanLine className="h-4 w-4 mr-2" />
                Scan Batch Barcode
              </Button>
            </div>
          )}

          {/* Quantity Input */}
          {!showBatchSelection && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Quantity to Pick</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14 shrink-0"
                  onClick={decrementQty}
                  disabled={qty <= 0 || isSubmitting}
                >
                  <Minus className="h-6 w-6" />
                </Button>
                <Input
                  type="number"
                  value={qty}
                  onChange={(e) =>
                    setQty(
                      Math.min(parseInt(e.target.value) || 0, item.targetQty)
                    )
                  }
                  className="h-14 text-center text-2xl font-medium"
                  disabled={isSubmitting}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14 shrink-0"
                  onClick={incrementQty}
                  disabled={qty >= item.targetQty || isSubmitting}
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!showBatchSelection && (
            <div className="space-y-3 pt-2">
              {/* Primary Pick Button - Opens Multi-Batch Sheet */}
              <Button
                size="lg"
                className="w-full h-14 text-lg gap-2"
                onClick={handleOpenMultiBatch}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Package className="h-5 w-5" />
                )}
                Pick ({item.targetQty})
              </Button>

              {/* Quick Full Pick Button */}
              <Button
                variant="secondary"
                size="lg"
                className="w-full h-12 gap-2"
                onClick={handleFullPick}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                Quick Pick All (Single Batch)
              </Button>

              {/* Partial Pick Button - only show if qty differs from target */}
              {qty !== item.targetQty && qty > 0 && (
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full h-12 gap-2"
                  onClick={handlePartialPick}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Check className="h-5 w-5" />
                  )}
                  Pick {qty} ({qty < item.targetQty ? "Partial" : "Custom"})
                </Button>
              )}

              {/* Secondary Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={handleOpenSubstitution}
                  disabled={isSubmitting}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Substitute
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-12 text-amber-600 hover:text-amber-700 hover:border-amber-300"
                  onClick={handleMarkShort}
                  disabled={isSubmitting}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Mark Short
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Multi-Batch Pick Sheet - DEFAULT picking UI */}
      <MultiBatchPickSheet
        open={showMultiBatchSheet}
        onOpenChange={setShowMultiBatchSheet}
        item={item}
        pickListId={pickListId}
        onConfirm={handleMultiBatchConfirm}
        isSubmitting={isSubmitting}
      />

      {/* Batch Substitution Sheet - with reason capture */}
      <BatchSubstitutionSheet
        open={showSubstitutionSheet}
        onOpenChange={setShowSubstitutionSheet}
        pickItemId={item.id}
        pickListId={pickListId}
        currentBatchNumber={item.originalBatchNumber || undefined}
        productName={productName}
        onConfirm={handleSubstitutionConfirm}
      />
    </Dialog>
  );
}
