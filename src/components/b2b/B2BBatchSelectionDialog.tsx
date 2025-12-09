'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Package } from 'lucide-react';
import type { BatchAllocation } from '@/lib/b2b/types';

export interface B2BBatch {
  id: string;
  batchNumber: string;
  varietyName: string | null;
  family: string | null;
  availableQty: number;
}

interface B2BBatchSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batches: B2BBatch[];
  productName: string;
  currentAllocations: BatchAllocation[];
  onConfirm: (allocations: BatchAllocation[]) => void;
}

export function B2BBatchSelectionDialog({
  open,
  onOpenChange,
  batches,
  productName,
  currentAllocations,
  onConfirm,
}: B2BBatchSelectionDialogProps) {
  const [allocations, setAllocations] = useState<Map<string, number>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      const initial = new Map<string, number>();
      currentAllocations.forEach((a) => {
        initial.set(a.batchId, a.qty);
      });
      setAllocations(initial);
      setSearchQuery('');
    }
  }, [open, currentAllocations]);

  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return batches;
    
    const q = searchQuery.toLowerCase();
    return batches.filter(
      (b) =>
        b.batchNumber.toLowerCase().includes(q) ||
        b.varietyName?.toLowerCase().includes(q) ||
        b.family?.toLowerCase().includes(q)
    );
  }, [batches, searchQuery]);

  const toggleBatch = (batchId: string, checked: boolean) => {
    const next = new Map(allocations);
    if (checked) {
      // Default to available quantity when selecting
      const batch = batches.find(b => b.id === batchId);
      next.set(batchId, batch?.availableQty || 0);
    } else {
      next.delete(batchId);
    }
    setAllocations(next);
  };

  const updateQty = (batchId: string, qty: number) => {
    const next = new Map(allocations);
    const batch = batches.find(b => b.id === batchId);
    const maxQty = batch?.availableQty || 0;
    next.set(batchId, Math.min(Math.max(0, qty), maxQty));
    setAllocations(next);
  };

  const totalSelected = Array.from(allocations.values()).reduce((sum, q) => sum + q, 0);
  const totalAvailable = batches.reduce((sum, b) => sum + b.availableQty, 0);

  const handleConfirm = () => {
    const result: BatchAllocation[] = [];
    allocations.forEach((qty, batchId) => {
      if (qty > 0) {
        const batch = batches.find((b) => b.id === batchId);
        if (batch) {
          result.push({
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            qty,
          });
        }
      }
    });
    onConfirm(result);
    onOpenChange(false);
  };

  // Helper to format batch display: family > variety · batch number
  const formatBatchLabel = (batch: B2BBatch) => {
    const family = batch.family || '';
    const variety = batch.varietyName || '';
    
    if (family && variety) {
      return `${family} > ${variety} · ${batch.batchNumber}`;
    } else if (variety) {
      return `${variety} · ${batch.batchNumber}`;
    }
    return batch.batchNumber;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Batches</DialogTitle>
          <DialogDescription>
            {productName} - {totalAvailable} available across {batches.length} batch(es)
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by batch, variety, or family..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Batch List */}
        <ScrollArea className="flex-1 min-h-0 max-h-[350px]">
          <div className="space-y-2 pr-4">
            {filteredBatches.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {batches.length === 0
                  ? 'No batches available for this product.'
                  : 'No batches match your search.'}
              </p>
            )}
            {filteredBatches.map((batch) => {
              const isSelected = allocations.has(batch.id);
              const qty = allocations.get(batch.id) ?? 0;

              return (
                <div
                  key={batch.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer ${
                    isSelected ? 'bg-primary/5 border-primary/40' : 'hover:bg-muted/30'
                  }`}
                  onClick={() => toggleBatch(batch.id, !isSelected)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => toggleBatch(batch.id, !!checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {formatBatchLabel(batch)}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" />
                      <span className="font-medium text-foreground">{batch.availableQty}</span>
                      <span>available</span>
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Label className="text-xs whitespace-nowrap sr-only">Qty:</Label>
                      <Input
                        type="number"
                        min="1"
                        max={batch.availableQty}
                        value={qty}
                        onChange={(e) => updateQty(batch.id, parseInt(e.target.value) || 0)}
                        className="w-20 h-8"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">/ {batch.availableQty}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-semibold">{totalSelected}</span>
            <span className="text-muted-foreground"> plants</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={totalSelected === 0}>
              Add to Cart
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

