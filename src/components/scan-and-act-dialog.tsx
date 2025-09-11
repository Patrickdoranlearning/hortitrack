// src/components/scan-and-act-dialog.tsx
'use client';
import React, { useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ScannerClient from '@/components/Scanner/ScannerClient';
import { useToast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (text: string) => void;
};

export default function ScannerDialog({ open, onOpenChange, onDetected }: Props) {
  const { toast } = useToast();
  const lockedRef = useRef(false);

  const handleDecoded = useCallback(
    (text: string) => {
      if (!text) return;
      if (lockedRef.current) return;
      lockedRef.current = true;
      try {
        onDetected(text);
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Scan error',
          description: e?.message || 'Could not process the scanned code.',
        });
      } finally {
        // small cooldown to prevent multi-fire on the same frame
        setTimeout(() => (lockedRef.current = false), 750);
      }
    },
    [onDetected, toast]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent /* a11y: include a description to remove the warning */>
        <DialogHeader>
          <DialogTitle>Scan code</DialogTitle>
          <DialogDescription>Point the camera at a batch QR/DataMatrix.</DialogDescription>
        </DialogHeader>
        {open && <ScannerClient onDecoded={handleDecoded} />}
      </DialogContent>
    </Dialog>
  );
}
