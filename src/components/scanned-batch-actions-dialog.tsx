'use client';

import type { Batch } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import {
  ClipboardList,
  MoveRight,
  Sparkles,
  Pencil,
  Trash2,
} from 'lucide-react';

interface ScannedBatchActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch | null;
  onLogAction: () => void;
  onTransplant: () => void;
  onGetRecommendations: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ScannedBatchActionsDialog({
  open,
  onOpenChange,
  batch,
  onLogAction,
  onTransplant,
  onGetRecommendations,
  onEdit,
  onDelete,
}: ScannedBatchActionsDialogProps) {
  if (!batch) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">
            Batch #{batch.batchNumber}
          </DialogTitle>
          <DialogDescription>
            {batch.plantFamily} - {batch.plantVariety}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <Button onClick={onLogAction} variant="outline">
            <ClipboardList />
            Log Action
          </Button>
          <Button
            onClick={onTransplant}
            variant="outline"
            disabled={batch.quantity === 0}
          >
            <MoveRight />
            Transplant
          </Button>
          <Button onClick={onGetRecommendations} variant="outline">
            <Sparkles />
            AI Tips
          </Button>
          <Button onClick={onEdit} variant="outline">
            <Pencil />
            Edit Batch
          </Button>
          <Button onClick={onDelete} variant="destructive" className="col-span-2">
            <Trash2 />
            Delete Batch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
