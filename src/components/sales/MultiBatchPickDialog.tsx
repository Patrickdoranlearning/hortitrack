'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  MapPin,
  Package,
  Check,
  Loader2,
  AlertTriangle,
  Minus,
  Plus,
  Info,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvailableBatch {
  id: string;
  batchNumber: string;
  quantity: number;
  location: string;
  grade?: string;
  status?: string;
  productName?: string;
}

interface BatchPick {
  id: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  location?: string;
  pickedAt?: string;
  pickedBy?: string;
}

interface BatchSelection {
  batchId: string;
  quantity: number;
  maxAvailable: number;
}

interface MultiBatchPickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickItemId: string;
  pickListId: string;
  productName: string;
  targetQty: number;
  currentPicks?: BatchPick[];
  onConfirm: (batches: Array<{ batchId: string; quantity: number }>, notes?: string) => Promise<void>;
}

export default function MultiBatchPickDialog({
  open,
  onOpenChange,
  pickItemId,
  pickListId,
  productName,
  targetQty,
  currentPicks: _currentPicks = [],
  onConfirm,
}: MultiBatchPickDialogProps) {
  const [batches, setBatches] = useState<AvailableBatch[]>([]);
  const [selections, setSelections] = useState<Map<string, BatchSelection>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  // Fetch available batches when dialog opens
  useEffect(() => {
    if (open && pickItemId) {
      setIsLoading(true);
      fetch(`/api/picking/${pickListId}/items/${pickItemId}/batches?includePicks=true`)
        .then(res => res.json())
        .then(data => {
          if (data.batches) {
            setBatches(data.batches);
            // Auto-suggest FEFO selection
            autoSuggestSelection(data.batches, targetQty);
          }
        })
        .catch(err => {
          console.error('Error fetching batches:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- autoSuggestSelection is stable via useCallback
  }, [open, pickItemId, pickListId, targetQty]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelections(new Map());
      setNotes('');
    }
  }, [open]);

  // Auto-suggest optimal batch selection using FEFO (First Expired, First Out)
  // Since batches are already ordered by planted_at (oldest first), we use that order
  const autoSuggestSelection = useCallback((availableBatches: AvailableBatch[], target: number) => {
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
  }, []);

  // Calculate totals
  const totalSelected = useMemo(() => {
    let total = 0;
    selections.forEach(s => { total += s.quantity; });
    return total;
  }, [selections]);

  const progress = targetQty > 0 ? Math.min(100, Math.round((totalSelected / targetQty) * 100)) : 0;
  const isShortPick = totalSelected > 0 && totalSelected < targetQty;
  const isComplete = totalSelected >= targetQty;
  const canSubmit = totalSelected > 0;

  // Toggle batch selection
  const toggleBatch = (batch: AvailableBatch) => {
    const newSelections = new Map(selections);
    if (newSelections.has(batch.id)) {
      newSelections.delete(batch.id);
    } else {
      // Calculate how much we still need
      let currentTotal = 0;
      newSelections.forEach(s => { currentTotal += s.quantity; });
      const remaining = Math.max(0, targetQty - currentTotal);
      const pickQty = Math.min(remaining, batch.quantity);

      if (pickQty > 0) {
        newSelections.set(batch.id, {
          batchId: batch.id,
          quantity: pickQty,
          maxAvailable: batch.quantity,
        });
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
      } else {
        newSelections.set(batchId, { ...selection, quantity: clampedQty });
      }
      setSelections(newSelections);
    }
  };

  // Increment/decrement helpers
  const incrementQty = (batchId: string) => {
    const selection = selections.get(batchId);
    if (selection && selection.quantity < selection.maxAvailable) {
      updateQuantity(batchId, selection.quantity + 1);
    }
  };

  const decrementQty = (batchId: string) => {
    const selection = selections.get(batchId);
    if (selection && selection.quantity > 0) {
      updateQuantity(batchId, selection.quantity - 1);
    }
  };

  // Fill remaining from a batch
  const fillFromBatch = (batch: AvailableBatch) => {
    let currentTotal = 0;
    selections.forEach(s => { currentTotal += s.quantity; });
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
    if (!canSubmit) return;

    setIsSubmitting(true);
    const batchesArray = Array.from(selections.values()).map(s => ({
      batchId: s.batchId,
      quantity: s.quantity,
    }));

    await onConfirm(batchesArray, notes || undefined);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pick Item
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="font-medium text-foreground">{productName}</span>
            <span className="block">
              Select batches to fulfill <strong>{targetQty}</strong> units
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Progress Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Selection Progress</span>
              <span className={cn(
                'font-medium',
                isComplete && 'text-green-600',
                isShortPick && 'text-amber-600'
              )}>
                {totalSelected} / {targetQty} units
              </span>
            </div>
            <Progress
              value={progress}
              className={cn(
                'h-3',
                isComplete && '[&>div]:bg-green-500',
                isShortPick && '[&>div]:bg-amber-500'
              )}
            />
            {isShortPick && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                Short pick - {targetQty - totalSelected} units short
              </div>
            )}
            {isComplete && totalSelected > targetQty && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                Over-picking by {totalSelected - targetQty} units
              </div>
            )}
          </div>

          {/* Available Batches */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">
                Available Batches
              </Label>
              {batches.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => autoSuggestSelection(batches, targetQty)}
                  className="h-7 text-xs gap-1"
                >
                  <Zap className="h-3 w-3" />
                  Auto-fill FEFO
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                <p className="font-medium">No batches available</p>
                <p className="text-sm text-muted-foreground">
                  There are no batches with available stock for this item
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {batches.map((batch) => {
                  const selection = selections.get(batch.id);
                  const isSelected = !!selection;
                  const qty = selection?.quantity || 0;

                  return (
                    <Card
                      key={batch.id}
                      className={cn(
                        'p-3 transition-all',
                        isSelected && 'border-primary ring-1 ring-primary bg-primary/5'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleBatch(batch)}
                          className="mt-1"
                        />

                        {/* Batch Info */}
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
                            {batch.productName && (
                              <span className="text-xs text-muted-foreground truncate">
                                {batch.productName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {batch.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {batch.quantity} available
                            </span>
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        {isSelected && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => decrementQty(batch.id)}
                              disabled={qty <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              value={qty}
                              onChange={(e) => updateQuantity(batch.id, parseInt(e.target.value) || 0)}
                              className="h-8 w-16 text-center text-sm"
                              min={1}
                              max={batch.quantity}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => incrementQty(batch.id)}
                              disabled={qty >= batch.quantity}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            {!isComplete && qty < batch.quantity && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs ml-1"
                                onClick={() => fillFromBatch(batch)}
                              >
                                Fill
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary */}
          {selections.size > 0 && (
            <div className="border rounded-lg p-3 bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Selection Summary</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Info className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">Batch Breakdown</p>
                      {Array.from(selections.values()).map(s => {
                        const batch = batches.find(b => b.id === s.batchId);
                        return (
                          <div key={s.batchId} className="flex justify-between">
                            <span className="font-mono text-xs">{batch?.batchNumber}</span>
                            <span>{s.quantity} units</span>
                          </div>
                        );
                      })}
                      <div className="border-t pt-2 flex justify-between font-medium">
                        <span>Total</span>
                        <span>{totalSelected} units</span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selections.size} batch{selections.size !== 1 ? 'es' : ''}</Badge>
                  <span className="text-lg font-semibold">{totalSelected}</span>
                  <span className="text-muted-foreground">/ {targetQty} units</span>
                </div>
                {isComplete && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    <Check className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                )}
                {isShortPick && (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Short
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Notes (optional) */}
          {selections.size > 0 && (
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Notes (optional)
              </Label>
              <Input
                placeholder="Add any notes about this pick..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
            className={cn(
              isComplete && 'bg-green-600 hover:bg-green-700',
              isShortPick && 'bg-amber-600 hover:bg-amber-700'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Picking...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {isShortPick ? `Confirm Short Pick (${totalSelected})` : `Confirm Pick (${totalSelected})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
