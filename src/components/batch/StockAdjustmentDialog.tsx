"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Minus, AlertTriangle } from "lucide-react";
import {
  adjustBatchStock,
  ADJUSTMENT_REASON_LABELS,
  type AdjustmentReason,
} from "@/app/actions/batch-stock";

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchNumber?: string;
  currentQuantity?: number;
  onSuccess?: (newQuantity: number) => void;
}

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  batchId,
  batchNumber,
  currentQuantity = 0,
  onSuccess,
}: StockAdjustmentDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [direction, setDirection] = React.useState<"increase" | "decrease">("increase");
  const [quantity, setQuantity] = React.useState("");
  const [reason, setReason] = React.useState<AdjustmentReason>("count_correction");
  const [notes, setNotes] = React.useState("");

  const resetForm = () => {
    setDirection("increase");
    setQuantity("");
    setReason("count_correction");
    setNotes("");
  };

  const handleSubmit = async () => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast({ variant: "destructive", title: "Invalid quantity", description: "Please enter a positive number" });
      return;
    }

    const adjustmentQty = direction === "increase" ? qty : -qty;
    const newQty = currentQuantity + adjustmentQty;

    if (newQty < 0) {
      toast({
        variant: "destructive",
        title: "Invalid adjustment",
        description: `Cannot reduce quantity below zero. Current: ${currentQuantity}`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await adjustBatchStock({
        batchId,
        quantity: adjustmentQty,
        reason,
        notes: notes || undefined,
      });

      if (result.success) {
        toast({
          title: "Stock adjusted",
          description: `${direction === "increase" ? "Added" : "Removed"} ${qty} units. New total: ${result.newQuantity}`,
        });
        resetForm();
        onOpenChange(false);
        onSuccess?.(result.newQuantity ?? newQty);
      } else {
        toast({ variant: "destructive", title: "Adjustment failed", description: result.error });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: String(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewQty = React.useMemo(() => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) return currentQuantity;
    return direction === "increase" ? currentQuantity + qty : currentQuantity - qty;
  }, [quantity, direction, currentQuantity]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Adjust the stock count for batch {batchNumber ? `#${batchNumber}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Stock Display */}
          <div className="p-3 rounded-lg bg-muted text-center">
            <div className="text-sm text-muted-foreground">Current Stock</div>
            <div className="text-2xl font-bold">{currentQuantity.toLocaleString()}</div>
          </div>

          {/* Direction Toggle */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Adjustment Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection("increase")}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                  direction === "increase"
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-muted hover:border-green-300"
                }`}
              >
                <Plus className="h-4 w-4" />
                Increase
              </button>
              <button
                type="button"
                onClick={() => setDirection("decrease")}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                  direction === "decrease"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-muted hover:border-red-300"
                }`}
              >
                <Minus className="h-4 w-4" />
                Decrease
              </button>
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter amount"
              className="text-lg"
            />
          </div>

          {/* Reason Selection */}
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as AdjustmentReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ADJUSTMENT_REASON_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional details..."
              rows={2}
            />
          </div>

          {/* Preview */}
          {quantity && parseInt(quantity, 10) > 0 && (
            <div className={`p-3 rounded-lg border ${previewQty < 0 ? "border-red-300 bg-red-50" : "border-blue-200 bg-blue-50"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">New Stock Total:</span>
                <span className={`text-lg font-bold ${previewQty < 0 ? "text-red-600" : "text-blue-700"}`}>
                  {previewQty < 0 ? (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Invalid
                    </span>
                  ) : (
                    previewQty.toLocaleString()
                  )}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {currentQuantity.toLocaleString()} {direction === "increase" ? "+" : "-"} {parseInt(quantity, 10).toLocaleString()} = {previewQty >= 0 ? previewQty.toLocaleString() : "Invalid"}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !quantity || parseInt(quantity, 10) <= 0 || previewQty < 0}
            className={direction === "increase" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adjusting...
              </>
            ) : (
              <>
                {direction === "increase" ? <Plus className="h-4 w-4 mr-1" /> : <Minus className="h-4 w-4 mr-1" />}
                {direction === "increase" ? "Add" : "Remove"} Stock
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StockAdjustmentDialog;
