'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { parseMaterialScanCode } from '@/lib/scan/parse';
import type { MaterialSearchResult } from './MaterialSearchCombobox';

// Dynamic import for the scanner to avoid SSR issues
const ScannerClient = dynamic(
  () => import('@/components/Scanner/ScannerClient'),
  {
    ssr: false,
    loading: () => <Skeleton className="aspect-video w-full rounded-lg" />,
  }
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMaterialFound: (material: MaterialSearchResult | null) => void;
};

type ScanState =
  | { status: 'scanning' }
  | { status: 'searching'; code: string }
  | { status: 'found'; material: MaterialSearchResult }
  | { status: 'not_found'; code: string }
  | { status: 'error'; message: string };

export function MaterialScannerDialog({
  open,
  onOpenChange,
  onMaterialFound,
}: Props) {
  const [scanState, setScanState] = useState<ScanState>({ status: 'scanning' });

  const handleDecode = useCallback(async (code: string) => {
    // Parse the scanned code
    const parsed = parseMaterialScanCode(code);
    if (!parsed) {
      setScanState({ status: 'not_found', code });
      return;
    }

    setScanState({ status: 'searching', code });

    try {
      // Build search params based on parsed type
      const params = new URLSearchParams({ limit: '1' });
      if (parsed.by === 'partNumber') {
        params.set('partNumber', parsed.value);
      } else {
        params.set('barcode', parsed.value);
      }

      const res = await fetch(`/api/materials/search?${params}`);
      if (!res.ok) {
        setScanState({ status: 'error', message: 'Search request failed' });
        return;
      }

      const data = await res.json().catch(() => null);
      if (!data) {
        setScanState({ status: 'error', message: 'Invalid response from server' });
        return;
      }
      const results = data.results ?? [];

      if (results.length > 0) {
        setScanState({ status: 'found', material: results[0] });
      } else {
        setScanState({ status: 'not_found', code });
      }
    } catch (err) {
      setScanState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (scanState.status === 'found') {
      onMaterialFound(scanState.material);
    }
  }, [scanState, onMaterialFound]);

  const handleCancel = useCallback(() => {
    onMaterialFound(null);
  }, [onMaterialFound]);

  const handleRetry = useCallback(() => {
    setScanState({ status: 'scanning' });
  }, []);

  // Reset state when dialog opens
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      setScanState({ status: 'scanning' });
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Material Barcode</DialogTitle>
          <DialogDescription>
            Point your camera at the material&apos;s barcode or QR code
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scanner */}
          {(scanState.status === 'scanning' || scanState.status === 'searching') && (
            <ScannerClient onDecoded={handleDecode} roiScale={0.75} />
          )}

          {/* Searching State */}
          {scanState.status === 'searching' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Looking up: {scanState.code}</span>
            </div>
          )}

          {/* Found State */}
          {scanState.status === 'found' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-green-900">
                    {scanState.material.name}
                  </p>
                  <p className="text-sm text-green-700">
                    {scanState.material.part_number}
                  </p>
                  <Badge
                    variant="outline"
                    className="mt-2 bg-white text-green-700 border-green-300"
                  >
                    {scanState.material.category_name}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleRetry}
                >
                  Scan Another
                </Button>
                <Button className="flex-1" onClick={handleConfirm}>
                  Use This Material
                </Button>
              </div>
            </div>
          )}

          {/* Not Found State */}
          {scanState.status === 'not_found' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-amber-900">
                    Material not found
                  </p>
                  <p className="text-sm text-amber-700">
                    No material matches the scanned code: {scanState.code}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleRetry}>
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {scanState.status === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-red-900">Error</p>
                  <p className="text-sm text-red-700">{scanState.message}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleRetry}>
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
