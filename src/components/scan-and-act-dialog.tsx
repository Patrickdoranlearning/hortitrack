// src/components/scan-and-act-dialog.tsx
'use client';
import React, { useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';

const ScannerClient = dynamic(() => import('@/components/Scanner/ScannerClient'), {
  ssr: false,
  loading: () => <Skeleton className="aspect-video w-full" />,
});

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (text: string) => void;
};

export default function ScannerDialog({ open, onOpenChange, onDetected }: Props) {
  const lockedRef = useRef(false);

  const handleDecoded = useCallback(
    (text: string) => {
      if (!text) return;
      if (lockedRef.current) return;
      lockedRef.current = true;
      try {
        onDetected(text);
      } catch (e: any) {
        toast.error(e?.message || 'Could not process the scanned code.');
      } finally {
        // small cooldown to prevent multi-fire on the same frame
        setTimeout(() => (lockedRef.current = false), 750);
      }
    },
    [onDetected]
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
