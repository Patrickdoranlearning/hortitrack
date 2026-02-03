'use client';

/**
 * MultiBatchPickDialog - Desktop dispatch batch picking
 *
 * This is a wrapper around the unified BatchPicker component.
 * It preserves the existing API for backward compatibility while
 * using the new unified picking experience.
 */

import { BatchPicker } from '@/components/picking/BatchPicker';

interface BatchPick {
  id: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  location?: string;
  pickedAt?: string;
  pickedBy?: string;
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
  currentPicks = [],
  onConfirm,
}: MultiBatchPickDialogProps) {
  return (
    <BatchPicker
      open={open}
      onOpenChange={onOpenChange}
      pickListId={pickListId}
      itemId={pickItemId}
      productName={productName}
      targetQty={targetQty}
      currentPicks={currentPicks}
      onConfirm={onConfirm}
    />
  );
}
