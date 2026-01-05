'use client';

import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  MapPin,
  Package,
  Check,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvailableBatch {
  id: string;
  batchNumber: string;
  quantity: number;
  location: string;
  grade?: string;
  status?: string;
}

interface BatchSubstitutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickItemId: string;
  pickListId: string;
  currentBatchNumber?: string;
  productName: string;
  onConfirm: (batchId: string, reason: string) => Promise<void>;
}

const substitutionReasons = [
  'Quality issue - batch not looking good',
  'Stock depleted - not enough quantity',
  'Location access issue',
  'Customer preference',
  'Other',
];

export default function BatchSubstitutionDialog({
  open,
  onOpenChange,
  pickItemId,
  pickListId,
  currentBatchNumber,
  productName,
  onConfirm,
}: BatchSubstitutionDialogProps) {
  const [batches, setBatches] = useState<AvailableBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [reason, setReason] = useState<string>(substitutionReasons[0]);
  const [customReason, setCustomReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch available batches when dialog opens
  useEffect(() => {
    if (open && pickItemId) {
      setIsLoading(true);
      fetch(`/api/picking/${pickListId}/items/${pickItemId}/batches`)
        .then(res => res.json())
        .then(data => {
          if (data.batches) {
            setBatches(data.batches);
          }
        })
        .catch(err => {
          console.error('Error fetching batches:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, pickItemId, pickListId]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedBatchId(null);
      setReason(substitutionReasons[0]);
      setCustomReason('');
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!selectedBatchId) return;

    setIsSubmitting(true);
    const finalReason = reason === 'Other' ? customReason : reason;
    await onConfirm(selectedBatchId, finalReason);
    setIsSubmitting(false);
  };

  const selectedBatch = batches.find(b => b.id === selectedBatchId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Substitute Batch
          </DialogTitle>
          <DialogDescription>
            Select an alternative batch for <strong>{productName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Current Batch Info */}
          {currentBatchNumber && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Current Batch</div>
              <Badge variant="outline" className="font-mono">
                {currentBatchNumber}
              </Badge>
            </div>
          )}

          {/* Available Batches */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Select Replacement Batch
            </Label>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                <p className="text-muted-foreground">No alternative batches available</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {batches.map((batch) => (
                  <Card
                    key={batch.id}
                    className={cn(
                      'p-3 cursor-pointer transition-all',
                      'hover:border-primary/50',
                      selectedBatchId === batch.id && 'border-primary ring-1 ring-primary'
                    )}
                    onClick={() => setSelectedBatchId(batch.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                          selectedBatchId === batch.id
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground/30'
                        )}>
                          {selectedBatchId === batch.id && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-mono font-medium">{batch.batchNumber}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {batch.location}
                            </span>
                            {batch.status && (
                              <Badge variant="secondary" className="text-[10px]">
                                {batch.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 font-medium">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {batch.quantity}
                        </div>
                        <div className="text-xs text-muted-foreground">available</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Reason Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Reason for Substitution
            </Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {substitutionReasons.map((r) => (
                <div key={r} className="flex items-center space-x-2">
                  <RadioGroupItem value={r} id={r} />
                  <Label htmlFor={r} className="text-sm font-normal cursor-pointer">
                    {r}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {reason === 'Other' && (
              <Textarea
                placeholder="Enter reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="mt-2"
                rows={2}
              />
            )}
          </div>
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
            disabled={!selectedBatchId || isSubmitting || (reason === 'Other' && !customReason)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Substituting...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Confirm Substitution
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}





