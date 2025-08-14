
'use client';

import type { Batch } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import {
  ClipboardList,
  MoveRight,
  Pencil,
  FileText,
} from 'lucide-react';

interface ScannedBatchActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch | null;
  onLogAction: () => void;
  onTransplant: () => void;
  onEdit: () => void;
  onGenerateProtocol: () => void;
}

export function ScannedBatchActionsDialog({
  open,
  onOpenChange,
  batch,
  onLogAction,
  onTransplant,
  onEdit,
  onGenerateProtocol,
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
          <Button onClick={onLogAction} variant="outline" className="h-12 text-base">
            <ClipboardList />
            Log Action
          </Button>
          <Button
            onClick={onTransplant}
            variant="outline"
            disabled={batch.quantity === 0}
            className="h-12 text-base"
          >
            <MoveRight />
            Transplant
          </Button>
          <Button onClick={onGenerateProtocol} variant="outline" className="h-12 text-base">
            <FileText />
            Gen. Protocol
          </Button>
          <Button onClick={onEdit} variant="outline" className="h-12 text-base">
            <Pencil />
            Edit Batch
          </Button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
