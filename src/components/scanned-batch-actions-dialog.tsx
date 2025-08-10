
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
  Sparkles,
  Pencil,
  FileText,
  MessageSquare,
} from 'lucide-react';

interface ScannedBatchActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch | null;
  onLogAction: () => void;
  onTransplant: () => void;
  onGetRecommendations: () => void;
  onEdit: () => void;
  onGenerateProtocol: () => void;
  onChat: () => void;
}

export function ScannedBatchActionsDialog({
  open,
  onOpenChange,
  batch,
  onLogAction,
  onTransplant,
  onGetRecommendations,
  onEdit,
  onGenerateProtocol,
  onChat,
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
          <Button onClick={onChat} variant="outline">
            <MessageSquare />
            Chat with AI
          </Button>
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
          <Button onClick={onGenerateProtocol} variant="outline">
            <FileText />
            Gen. Protocol
          </Button>
          <Button onClick={onEdit} variant="outline">
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
