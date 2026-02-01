"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin,
  Package,
  Check,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess, vibrateWarning } from "@/lib/haptics";

interface AvailableBatch {
  id: string;
  batchNumber: string;
  quantity: number;
  location: string;
  grade?: string;
  status?: string;
}

interface BatchSubstitutionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickItemId: string;
  pickListId: string;
  currentBatchNumber?: string;
  productName: string;
  onConfirm: (batchId: string, reason: string) => Promise<void>;
}

const substitutionReasons = [
  "Quality issue",
  "Not enough quantity",
  "Location access issue",
  "Customer preference",
  "Other",
];

/**
 * Mobile-optimized batch substitution sheet for worker picking flow.
 * Uses Sheet component for better mobile UX with swipe-to-close.
 */
export function BatchSubstitutionSheet({
  open,
  onOpenChange,
  pickItemId,
  pickListId,
  currentBatchNumber,
  productName,
  onConfirm,
}: BatchSubstitutionSheetProps) {
  const [batches, setBatches] = useState<AvailableBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch available batches when sheet opens
  useEffect(() => {
    if (open && pickItemId) {
      setIsLoading(true);
      fetch(`/api/picking/${pickListId}/items/${pickItemId}/batches`)
        .then((res) => res.json())
        .then((data) => {
          if (data.batches) {
            setBatches(data.batches);
          }
        })
        .catch((err) => {
          console.error("Error fetching batches:", err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, pickItemId, pickListId]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setSelectedBatchId(null);
      setSelectedReason(null);
      setCustomReason("");
    }
  }, [open]);

  const handleSelectBatch = (batchId: string) => {
    vibrateTap();
    setSelectedBatchId(batchId);
  };

  const handleSelectReason = (reason: string) => {
    vibrateTap();
    setSelectedReason(reason);
  };

  const handleConfirm = async () => {
    if (!selectedBatchId || !selectedReason) return;

    vibrateTap();
    setIsSubmitting(true);
    const finalReason =
      selectedReason === "Other" ? customReason : selectedReason;
    try {
      await onConfirm(selectedBatchId, finalReason);
      vibrateSuccess();
    } catch {
      vibrateWarning();
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    selectedBatchId &&
    selectedReason &&
    (selectedReason !== "Other" || customReason.trim().length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5" />
            Substitute Batch
          </SheetTitle>
          <SheetDescription>
            Select an alternative batch for{" "}
            <span className="font-medium text-foreground">{productName}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pb-20">
          {/* Current Batch Info */}
          {currentBatchNumber && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">
                Current Batch
              </div>
              <Badge variant="outline" className="font-mono">
                {currentBatchNumber}
              </Badge>
            </div>
          )}

          {/* Available Batches */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Select Replacement Batch
            </Label>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                <p className="text-muted-foreground">
                  No alternative batches available
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {batches.map((batch) => (
                  <button
                    key={batch.id}
                    className={cn(
                      "w-full p-4 rounded-xl border text-left transition-all",
                      "active:scale-[0.98]",
                      selectedBatchId === batch.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-primary/50"
                    )}
                    onClick={() => handleSelectBatch(batch.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                            selectedBatchId === batch.id
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/30"
                          )}
                        >
                          {selectedBatchId === batch.id && (
                            <Check className="h-3.5 w-3.5 text-primary-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-mono font-medium text-base">
                            {batch.batchNumber}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {batch.location}
                            </span>
                            {batch.status && (
                              <Badge variant="secondary" className="text-xs">
                                {batch.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 font-semibold text-lg">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {batch.quantity}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          available
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reason Selection - Quick tap buttons */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Reason for Substitution
            </Label>
            <div className="flex flex-wrap gap-2">
              {substitutionReasons.map((reason) => (
                <button
                  key={reason}
                  className={cn(
                    "px-4 py-2 rounded-full border text-sm font-medium transition-all",
                    "active:scale-[0.98]",
                    selectedReason === reason
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 hover:border-primary/50"
                  )}
                  onClick={() => handleSelectReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>

            {selectedReason === "Other" && (
              <Textarea
                placeholder="Enter reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="mt-3 min-h-[80px]"
              />
            )}
          </div>
        </div>

        {/* Fixed bottom action button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button
            size="lg"
            className="w-full h-14 text-lg"
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Substituting...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Confirm Substitution
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default BatchSubstitutionSheet;
