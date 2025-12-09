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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MapPin, Calendar } from 'lucide-react';

export interface Batch {
  id: string;
  batchNumber: string;
  plantVariety: string;
  family?: string | null;
  size: string;
  quantity: number;
  grade?: string;
  location?: string;
  status?: string;
  plantingDate?: string;
}

export interface BatchAllocation {
  batchId: string;
  batchNumber: string;
  plantVariety: string;
  family?: string | null;
  size: string;
  qty: number;
  grade?: string;
  location?: string;
}

interface BatchSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batches: Batch[];
  productName: string;
  productVariety: string;
  productSize: string;
  currentAllocations: BatchAllocation[];
  onConfirm: (allocations: BatchAllocation[]) => void;
}

export function BatchSelectionDialog({
  open,
  onOpenChange,
  batches,
  productName,
  productVariety,
  productSize,
  currentAllocations,
  onConfirm,
}: BatchSelectionDialogProps) {
  const [allocations, setAllocations] = useState<Map<string, number>>(new Map());
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const initial = new Map<string, number>();
      currentAllocations.forEach((a) => {
        initial.set(a.batchId, a.qty);
      });
      setAllocations(initial);
      setSearchQuery('');
      setGradeFilter(null);
      setLocationFilter(null);
    }
  }, [open, currentAllocations]);

  const grades = useMemo(
    () => Array.from(new Set(batches.map((b) => b.grade).filter(Boolean))),
    [batches]
  );

  const locations = useMemo(
    () => Array.from(new Set(batches.map((b) => b.location).filter(Boolean))),
    [batches]
  );

  const filteredBatches = useMemo(() => {
    let result = batches;

    if (gradeFilter) {
      result = result.filter((b) => b.grade === gradeFilter);
    }

    if (locationFilter) {
      result = result.filter((b) => b.location === locationFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.batchNumber.toLowerCase().includes(q) ||
          b.plantVariety.toLowerCase().includes(q) ||
          b.family?.toLowerCase().includes(q) ||
          b.location?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [batches, gradeFilter, locationFilter, searchQuery]);

  const toggleBatch = (batchId: string, checked: boolean) => {
    const next = new Map(allocations);
    if (checked) {
      next.set(batchId, 0);
    } else {
      next.delete(batchId);
    }
    setAllocations(next);
  };

  const updateQty = (batchId: string, qty: number) => {
    const next = new Map(allocations);
    next.set(batchId, Math.max(0, qty));
    setAllocations(next);
  };

  const totalSelected = Array.from(allocations.values()).reduce((sum, q) => sum + q, 0);
  const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);

  const handleConfirm = () => {
    const result: BatchAllocation[] = [];
    allocations.forEach((qty, batchId) => {
      if (qty > 0) {
        const batch = batches.find((b) => b.id === batchId);
        if (batch) {
          result.push({
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            plantVariety: batch.plantVariety || productVariety,
            family: batch.family || null,
            size: batch.size || productSize,
            qty,
            grade: batch.grade,
            location: batch.location,
          });
        }
      }
    });
    onConfirm(result);
    onOpenChange(false);
  };

  // Helper to format batch display: family > variety · size · batch number
  const formatBatchLabel = (batch: Batch) => {
    const family = batch.family || '';
    const variety = batch.plantVariety || productVariety || 'Unknown';
    const size = batch.size || productSize || '';
    
    // Format as: Family > Variety · Size · Batch Number
    const varietyPart = family ? `${family} > ${variety}` : variety;
    const parts = [varietyPart, size, batch.batchNumber].filter(Boolean);
    return parts.join(' · ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Batches for {productName}</DialogTitle>
          <DialogDescription>
            Choose one or more batches and specify the quantity from each. Total available: {totalAvailable} plants across {batches.length} batch(es).
          </DialogDescription>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="space-y-3 border-b pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by batch number, variety, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Grade Filter */}
            {grades.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Grade:</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={gradeFilter === null ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setGradeFilter(null)}
                  >
                    All
                  </Button>
                  {grades.map((g) => (
                    <Button
                      key={g}
                      type="button"
                      variant={gradeFilter === g ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setGradeFilter(g!)}
                    >
                      {g}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Location Filter */}
            {locations.length > 1 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Location:</Label>
                <div className="flex gap-1 flex-wrap">
                  <Button
                    type="button"
                    variant={locationFilter === null ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setLocationFilter(null)}
                  >
                    All
                  </Button>
                  {locations.slice(0, 5).map((loc) => (
                    <Button
                      key={loc}
                      type="button"
                      variant={locationFilter === loc ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setLocationFilter(loc!)}
                    >
                      {loc}
                    </Button>
                  ))}
                  {locations.length > 5 && (
                    <span className="text-xs text-muted-foreground self-center">+{locations.length - 5} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Batch List */}
        <ScrollArea className="flex-1 min-h-0 max-h-[400px]">
          <div className="space-y-2 pr-4">
            {filteredBatches.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {batches.length === 0
                  ? 'No batches available for this product.'
                  : 'No batches match your filters.'}
              </p>
            )}
            {filteredBatches.map((batch) => {
              const isSelected = allocations.has(batch.id);
              const qty = allocations.get(batch.id) ?? 0;

              return (
                <div
                  key={batch.id}
                  className={`flex items-start gap-3 p-3 border rounded-lg transition-colors cursor-pointer ${
                    isSelected ? 'bg-primary/5 border-primary/40' : 'hover:bg-muted/30'
                  }`}
                  onClick={() => toggleBatch(batch.id, !isSelected)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => toggleBatch(batch.id, !!checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {formatBatchLabel(batch)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{batch.quantity} available</span>
                      {batch.grade && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          Grade {batch.grade}
                        </Badge>
                      )}
                      {batch.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {batch.location}
                        </span>
                      )}
                      {batch.plantingDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(batch.plantingDate).toLocaleDateString()}
                        </span>
                      )}
                      {batch.status && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          {batch.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Label className="text-xs whitespace-nowrap">Qty:</Label>
                      <Input
                        type="number"
                        min="0"
                        max={batch.quantity}
                        value={qty}
                        onChange={(e) => updateQty(batch.id, parseInt(e.target.value) || 0)}
                        className="w-20 h-8"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">/ {batch.quantity}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Total selected: </span>
            <span className="font-semibold">{totalSelected}</span>
            <span className="text-muted-foreground"> plants</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={totalSelected === 0}>
              Confirm Selection
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

