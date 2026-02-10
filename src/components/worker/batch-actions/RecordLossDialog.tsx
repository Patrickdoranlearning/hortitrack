"use client";

import * as React from "react";
import { useState } from "react";
import { Trash2, Loader2, Minus, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

const LOSS_REASONS = [
  { value: "disease", label: "Disease" },
  { value: "old_stock", label: "Old Unsold Stock" },
  { value: "drought", label: "Drought" },
  { value: "dead", label: "Dead" },
  { value: "poor_quality", label: "Poor Quality" },
  { value: "pest_damage", label: "Pest Damage" },
  { value: "frost_damage", label: "Frost Damage" },
  { value: "other", label: "Other" },
];

interface RecordLossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  maxQuantity: number;
  onSuccess: (message: string) => void;
}

export function RecordLossDialog({
  open,
  onOpenChange,
  batchId,
  maxQuantity,
  onSuccess,
}: RecordLossDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleQuantityChange = (value: number) => {
    const newValue = Math.max(1, Math.min(maxQuantity, value));
    setQuantity(newValue);
  };

  const handleIncrement = () => {
    handleQuantityChange(quantity + 1);
  };

  const handleDecrement = () => {
    handleQuantityChange(quantity - 1);
  };

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Please select a reason for the loss");
      return;
    }

    if (quantity < 1 || quantity > maxQuantity) {
      toast.error(`Quantity must be between 1 and ${maxQuantity}`);
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/worker/batches/${batchId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "loss",
          quantity,
          reason: LOSS_REASONS.find((r) => r.value === reason)?.label ?? reason,
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to record loss");
      }

      const data = await response.json();
      onSuccess(data.message || `Recorded loss of ${quantity} units`);

      // Reset form
      setQuantity(1);
      setReason("");
      setNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record loss");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onOpenChange(false);
      setQuantity(1);
      setReason("");
      setNotes("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Record Loss
          </DialogTitle>
          <DialogDescription>
            Record plants that have been lost or dumped
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Available quantity info */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">Available: </span>
            <span className="font-medium">{maxQuantity.toLocaleString()} units</span>
          </div>

          {/* Quantity input */}
          <div className="space-y-2">
            <Label>Quantity Lost</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 flex-shrink-0"
                onClick={handleDecrement}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                className="h-12 text-center text-lg font-semibold"
                value={quantity}
                onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                min={1}
                max={maxQuantity}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 flex-shrink-0"
                onClick={handleIncrement}
                disabled={quantity >= maxQuantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {/* Quick quantity buttons */}
            <div className="flex gap-2">
              {[10, 25, 50, 100].map((val) => (
                <Button
                  key={val}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex-1",
                    quantity === val && "border-primary text-primary"
                  )}
                  onClick={() => handleQuantityChange(val)}
                  disabled={val > maxQuantity}
                >
                  {val}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "flex-1",
                  quantity === maxQuantity && "border-primary text-primary"
                )}
                onClick={() => handleQuantityChange(maxQuantity)}
              >
                All
              </Button>
            </div>
          </div>

          {/* Reason selector */}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {LOSS_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="loss-notes">Notes (optional)</Label>
            <Textarea
              id="loss-notes"
              placeholder="Add any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Warning for large loss */}
          {quantity === maxQuantity && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              This will write off the entire batch.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-12"
              onClick={handleSubmit}
              disabled={!reason || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                `Record ${quantity} Lost`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
