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
import { Loader2, Trash2, AlertTriangle, Bug, Thermometer, Scissors, Cog } from "lucide-react";
import {
  recordBatchLoss,
  LOSS_REASON_LABELS,
  type LossReason,
} from "@/app/actions/batch-stock";

interface RecordLossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchNumber?: string;
  currentQuantity?: number;
  onSuccess?: (newQuantity: number) => void;
}

const LOSS_REASON_ICONS: Record<LossReason, React.ReactNode> = {
  pest_damage: <Bug className="h-4 w-4" />,
  disease: <AlertTriangle className="h-4 w-4" />,
  environmental: <Thermometer className="h-4 w-4" />,
  quality_cull: <Scissors className="h-4 w-4" />,
  mechanical_damage: <Cog className="h-4 w-4" />,
  other: <Trash2 className="h-4 w-4" />,
};

export function RecordLossDialog({
  open,
  onOpenChange,
  batchId,
  batchNumber,
  currentQuantity = 0,
  onSuccess,
}: RecordLossDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [quantity, setQuantity] = React.useState("");
  const [reason, setReason] = React.useState<LossReason>("quality_cull");
  const [notes, setNotes] = React.useState("");

  const resetForm = () => {
    setQuantity("");
    setReason("quality_cull");
    setNotes("");
  };

  const handleSubmit = async () => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast({ variant: "destructive", title: "Invalid quantity", description: "Please enter a positive number" });
      return;
    }

    if (qty > currentQuantity) {
      toast({
        variant: "destructive",
        title: "Invalid quantity",
        description: `Cannot record loss greater than current stock (${currentQuantity})`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await recordBatchLoss({
        batchId,
        quantity: qty,
        reason,
        notes: notes || undefined,
      });

      if (result.success) {
        const wasArchived = result.newQuantity === 0;
        toast({
          title: wasArchived ? "Batch archived" : "Loss recorded",
          description: wasArchived
            ? `Recorded ${qty} units lost. Batch has been archived (0 remaining).`
            : `Recorded ${qty} units lost. ${result.newQuantity} remaining.`,
        });
        resetForm();
        onOpenChange(false);
        onSuccess?.(result.newQuantity ?? 0);
      } else {
        toast({ variant: "destructive", title: "Recording failed", description: result.error });
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
    return Math.max(0, currentQuantity - qty);
  }, [quantity, currentQuantity]);

  const willArchive = previewQty === 0 && parseInt(quantity, 10) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            Record Loss
          </DialogTitle>
          <DialogDescription>
            Record plant losses for batch {batchNumber ? `#${batchNumber}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Stock Display */}
          <div className="p-3 rounded-lg bg-muted text-center">
            <div className="text-sm text-muted-foreground">Current Stock</div>
            <div className="text-2xl font-bold">{currentQuantity.toLocaleString()}</div>
          </div>

          {/* Quantity Input */}
          <div>
            <Label htmlFor="loss-quantity">Units Lost</Label>
            <Input
              id="loss-quantity"
              type="number"
              min="1"
              max={currentQuantity}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter amount"
              className="text-lg"
            />
          </div>

          {/* Reason Selection */}
          <div>
            <Label htmlFor="loss-reason">Loss Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as LossReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LOSS_REASON_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex items-center gap-2">
                      {LOSS_REASON_ICONS[value as LossReason]}
                      {label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="loss-notes">Notes (optional)</Label>
            <Textarea
              id="loss-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add details about the loss..."
              rows={2}
            />
          </div>

          {/* Preview */}
          {quantity && parseInt(quantity, 10) > 0 && (
            <div className={`p-3 rounded-lg border ${willArchive ? "border-orange-300 bg-orange-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">After Loss:</span>
                <span className={`text-lg font-bold ${willArchive ? "text-orange-700" : "text-red-700"}`}>
                  {previewQty.toLocaleString()} remaining
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {currentQuantity.toLocaleString()} - {parseInt(quantity, 10).toLocaleString()} = {previewQty.toLocaleString()}
              </div>
              {willArchive && (
                <div className="flex items-center gap-1 mt-2 text-sm text-orange-700 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Batch will be archived (0 stock)
                </div>
              )}
            </div>
          )}

          {/* Exceeds Stock Warning */}
          {parseInt(quantity, 10) > currentQuantity && (
            <div className="p-3 rounded-lg border border-red-300 bg-red-50">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Cannot record more than current stock ({currentQuantity})
                </span>
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
            disabled={isSubmitting || !quantity || parseInt(quantity, 10) <= 0 || parseInt(quantity, 10) > currentQuantity}
            variant="destructive"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1" />
                Record Loss
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RecordLossDialog;
