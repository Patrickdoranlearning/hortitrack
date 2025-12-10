'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './StatusBadge';
import { B2BBatchSelectionDialog, type B2BBatch } from './B2BBatchSelectionDialog';
import { cn } from '@/lib/utils';
import type {
  VarietyInfo,
  VarietyAllocation,
  BatchAllocation,
} from '@/lib/b2b/types';

interface VarietyAllocationTableProps {
  varieties: VarietyInfo[];
  varietyAllocations: Map<string, VarietyAllocation>;
  onQuantityChange: (varietyId: string, qty: number) => void;
  onBatchesChange: (varietyId: string, batches: BatchAllocation[]) => void;
  productName: string;
}

/**
 * Variety allocation table for Level 2 accordion content
 * Shows grid of varieties with quantity inputs and batch selection
 */
export function VarietyAllocationTable({
  varieties,
  varietyAllocations,
  onQuantityChange,
  onBatchesChange,
  productName,
}: VarietyAllocationTableProps) {
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [selectedVariety, setSelectedVariety] = useState<VarietyInfo | null>(
    null
  );

  const handleBatchIconClick = (variety: VarietyInfo) => {
    setSelectedVariety(variety);
    setBatchDialogOpen(true);
  };

  const handleBatchConfirm = (batches: BatchAllocation[]) => {
    if (selectedVariety) {
      onBatchesChange(selectedVariety.varietyId, batches);
    }
    setBatchDialogOpen(false);
  };

  // Convert variety batches to B2BBatch format for dialog
  const dialogBatches: B2BBatch[] =
    selectedVariety?.batches.map((b) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      varietyName: selectedVariety.varietyName,
      family: selectedVariety.family,
      availableQty: b.availableQty,
      notes: b.notes,
      locationName: b.locationName,
      plantedAt: b.plantedAt,
    })) || [];

  const currentBatchAllocations =
    selectedVariety
      ? varietyAllocations.get(selectedVariety.varietyId)?.batchAllocations || []
      : [];

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted text-xs font-medium">
          <div className="col-span-1">Status</div>
          <div className="col-span-4">Variety</div>
          <div className="col-span-2 text-right">Available</div>
          <div className="col-span-2">Quantity</div>
          <div className="col-span-2 text-center">Batches</div>
          <div className="col-span-1"></div>
        </div>

        {/* Variety Rows */}
        {varieties.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No varieties available for this product
          </div>
        )}
        {varieties.map((variety) => {
          const allocation = varietyAllocations.get(variety.varietyId);
          const hasBatchSelection = allocation?.hasBatchSelection || false;
          const quantity = allocation?.quantity || 0;
          const batchCount = allocation?.batchAllocations?.length || 0;

          return (
            <div
              key={variety.varietyId}
              className={cn(
                'grid grid-cols-12 gap-2 px-3 py-3 border-t items-center transition-colors',
                hasBatchSelection && 'bg-blue-50 border-blue-200'
              )}
            >
              {/* Status Indicator */}
              <div className="col-span-1">
                <StatusBadge status={variety.status} size="md" />
              </div>

              {/* Variety Name */}
              <div className="col-span-4">
                <div className="font-medium text-sm">{variety.varietyName}</div>
                <div className="text-xs text-muted-foreground">
                  {variety.batchCount} batch{variety.batchCount !== 1 ? 'es' : ''}{' '}
                  available
                </div>
              </div>

              {/* Available Quantity */}
              <div className="col-span-2 text-right">
                <span className="text-sm font-medium">
                  {variety.totalAvailableQty}
                </span>
              </div>

              {/* Quantity Input */}
              <div className="col-span-2">
                <Input
                  type="number"
                  min="0"
                  max={variety.totalAvailableQty}
                  value={quantity || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    const clamped = Math.min(
                      Math.max(0, val),
                      variety.totalAvailableQty
                    );
                    onQuantityChange(variety.varietyId, clamped);
                  }}
                  placeholder="0"
                  className="h-9 text-center"
                  disabled={hasBatchSelection} // Disabled when batch selection active
                />
              </div>

              {/* Batch Selection Info */}
              <div className="col-span-2 text-center">
                {hasBatchSelection && batchCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {batchCount} selected
                  </Badge>
                )}
              </div>

              {/* Batch Icon Button */}
              <div className="col-span-1 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBatchIconClick(variety)}
                  className="h-8 w-8 p-0"
                  title="Select specific batches"
                >
                  <Package className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Batch Selection Dialog */}
      <B2BBatchSelectionDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        batches={dialogBatches}
        productName={`${productName} - ${selectedVariety?.varietyName || ''}`}
        currentAllocations={currentBatchAllocations}
        onConfirm={handleBatchConfirm}
      />
    </>
  );
}
