"use client";

/**
 * PickingBatchSelector - Worker app batch picking
 *
 * This is a wrapper around the unified BatchPicker component.
 * It preserves the existing API for backward compatibility while
 * using the new unified picking experience.
 */

import { BatchPicker } from "@/components/picking/BatchPicker";
import type { BatchPick } from "@/server/sales/picking";

interface PickingBatchSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickListId: string;
  itemId: string;
  productName: string;
  targetQty: number;
  currentPicks: BatchPick[];
  onSave: (batches: Array<{ batchId: string; quantity: number }>) => Promise<void>;
  isSubmitting: boolean;
}

export function PickingBatchSelector({
  open,
  onOpenChange,
  pickListId,
  itemId,
  productName,
  targetQty,
  currentPicks,
  onSave,
  isSubmitting,
}: PickingBatchSelectorProps) {
  // Adapt onSave to onConfirm (onSave doesn't take notes, onConfirm does)
  const handleConfirm = async (
    batches: Array<{ batchId: string; quantity: number }>,
    _notes?: string
  ) => {
    await onSave(batches);
  };

  return (
    <BatchPicker
      open={open}
      onOpenChange={onOpenChange}
      pickListId={pickListId}
      itemId={itemId}
      productName={productName}
      targetQty={targetQty}
      currentPicks={currentPicks}
      onConfirm={handleConfirm}
      isSubmitting={isSubmitting}
    />
  );
}

export default PickingBatchSelector;
