'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Camera,
  Search,
  MapPin,
  Loader2,
  Plus,
  Minus,
  Check,
  X,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrateTap, vibrateSuccess, vibrateError } from '@/lib/haptics';
import ScannerClient from '@/components/Scanner/ScannerClient';
import type { BatchPick } from '@/server/sales/picking';

// ============================================================================
// TYPES
// ============================================================================

export interface AvailableBatch {
  id: string;
  batchNumber: string;
  quantity: number;
  location: string;
  status?: string;
  productName?: string;
  shelfQuantity?: number;
  plantedAt?: string;
}

export interface BatchSelection {
  batch: AvailableBatch;
  quantity: number;
}

export interface BatchPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickListId: string;
  itemId: string;
  productName: string;
  targetQty: number;
  currentPicks?: BatchPick[];
  onConfirm: (
    batches: Array<{ batchId: string; quantity: number }>,
    notes?: string
  ) => Promise<void>;
  isSubmitting?: boolean;
}

type PickTab = 'pick' | 'search';

// ============================================================================
// HOOK: useMediaQuery
// ============================================================================

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// ============================================================================
// COMPONENT: BatchPicker (Scan-first, one-batch-at-a-time)
// ============================================================================

export function BatchPicker({
  open,
  onOpenChange,
  pickListId,
  itemId,
  productName,
  targetQty,
  currentPicks = [],
  onConfirm,
  isSubmitting = false,
}: BatchPickerProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // State
  const [tab, setTab] = useState<PickTab>('pick');
  const [availableBatches, setAvailableBatches] = useState<AvailableBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmedBatches, setConfirmedBatches] = useState<Map<string, BatchSelection>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // One-at-a-time: the batch currently being confirmed
  const [confirmingBatch, setConfirmingBatch] = useState<AvailableBatch | null>(null);
  const [confirmQty, setConfirmQty] = useState('');

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Calculate totals from confirmed batches
  const totalPicked = useMemo(() => {
    let sum = 0;
    confirmedBatches.forEach((s) => { sum += s.quantity; });
    return sum;
  }, [confirmedBatches]);

  const remaining = targetQty - totalPicked;
  const progress = targetQty > 0 ? Math.min(100, Math.round((totalPicked / targetQty) * 100)) : 0;
  const isShortPick = totalPicked > 0 && totalPicked < targetQty;
  const isComplete = totalPicked >= targetQty;

  // Effective available qty for a batch (subtract already-confirmed qty)
  const getEffectiveAvailable = useCallback((batch: AvailableBatch): number => {
    const alreadyConfirmed = confirmedBatches.get(batch.id)?.quantity || 0;
    return Math.max(0, batch.quantity - alreadyConfirmed);
  }, [confirmedBatches]);

  // Initialize from current picks (for re-editing)
  useEffect(() => {
    if (open && currentPicks.length > 0) {
      const initial = new Map<string, BatchSelection>();
      for (const pick of currentPicks) {
        initial.set(pick.batchId, {
          batch: {
            id: pick.batchId,
            batchNumber: pick.batchNumber,
            quantity: pick.quantity,
            location: pick.location || '',
          },
          quantity: pick.quantity,
        });
      }
      setConfirmedBatches(initial);
    } else if (open) {
      setConfirmedBatches(new Map());
    }
  }, [open, currentPicks]);

  // Fetch available batches when dialog opens
  const fetchAvailableBatches = useCallback(async () => {
    setLoadingBatches(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/picking/${pickListId}/items/${itemId}/batches?includePicks=true`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.batches) {
        setAvailableBatches(data.batches);
      }
    } catch {
      setError('Failed to load batches');
    } finally {
      setLoadingBatches(false);
    }
  }, [pickListId, itemId]);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      fetchAvailableBatches();
      setTab('pick');
      setSearchQuery('');
      setError(null);
      setConfirmingBatch(null);
      setConfirmQty('');
    }
  }, [open, fetchAvailableBatches]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Search with debounce
  useEffect(() => {
    if (tab !== 'search' || !searchQuery.trim()) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoadingBatches(true);
      try {
        const res = await fetch(
          `/api/batches/search?q=${encodeURIComponent(searchQuery)}&limit=20`
        );
        const data = await res.json();
        if (data.batches) {
          setAvailableBatches(
            data.batches.map((b: Record<string, unknown>) => ({
              id: b.id as string,
              batchNumber: b.batch_number as string,
              quantity: (b.quantity as number) || 0,
              location: (b.location_name as string) || '',
              status: b.status as string,
            }))
          );
        }
      } catch {
        // Keep existing batches on error
      } finally {
        setLoadingBatches(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, tab]);

  // Focus quantity input when confirming batch changes
  useEffect(() => {
    if (confirmingBatch && qtyInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => qtyInputRef.current?.select(), 50);
    }
  }, [confirmingBatch]);

  // === ACTIONS ===

  // Select a batch for quantity confirmation
  const selectBatch = useCallback((batch: AvailableBatch) => {
    vibrateTap();
    const effectiveAvail = getEffectiveAvailable(batch);
    if (effectiveAvail <= 0) {
      vibrateError();
      setError(`Batch ${batch.batchNumber} has no remaining available stock`);
      return;
    }
    const suggestedQty = Math.min(effectiveAvail, Math.max(remaining, 1));
    setConfirmingBatch(batch);
    setConfirmQty(String(suggestedQty));
    setError(null);
  }, [getEffectiveAvailable, remaining]);

  // Handle barcode scan
  const handleScan = useCallback(
    (scannedText: string) => {
      vibrateTap();
      let batchNumber = scannedText;
      if (scannedText.startsWith('ht:batch:')) {
        batchNumber = scannedText.slice(9);
      } else if (scannedText.startsWith('BATCH:')) {
        batchNumber = scannedText.slice(6);
      }

      const matchingBatch = availableBatches.find(
        (b) => b.batchNumber.toLowerCase() === batchNumber.toLowerCase()
      );

      if (matchingBatch) {
        vibrateSuccess();
        selectBatch(matchingBatch);
      } else {
        vibrateError();
        setError(`Batch ${batchNumber} not found or not available for this item`);
      }
    },
    [availableBatches, selectBatch]
  );

  // Confirm the quantity for the currently selected batch
  const confirmBatchPick = useCallback(() => {
    if (!confirmingBatch) return;
    const qty = parseInt(confirmQty, 10);
    if (!qty || qty <= 0) return;

    const effectiveAvail = getEffectiveAvailable(confirmingBatch);
    const clampedQty = Math.min(qty, effectiveAvail);
    if (clampedQty <= 0) return;

    vibrateSuccess();
    setConfirmedBatches((prev) => {
      const next = new Map(prev);
      const existing = next.get(confirmingBatch.id);
      if (existing) {
        // Add to existing confirmed quantity
        const newQty = Math.min(existing.quantity + clampedQty, confirmingBatch.quantity);
        next.set(confirmingBatch.id, { batch: confirmingBatch, quantity: newQty });
      } else {
        next.set(confirmingBatch.id, { batch: confirmingBatch, quantity: clampedQty });
      }
      return next;
    });

    setConfirmingBatch(null);
    setConfirmQty('');
    setError(null);
  }, [confirmingBatch, confirmQty, getEffectiveAvailable]);

  // Remove a confirmed batch
  const removeConfirmedBatch = useCallback((batchId: string) => {
    vibrateTap();
    setConfirmedBatches((prev) => {
      const next = new Map(prev);
      next.delete(batchId);
      return next;
    });
  }, []);

  // Submit all confirmed batches
  const handleSubmit = useCallback(async () => {
    if (confirmedBatches.size === 0) {
      setError('Please pick at least one batch');
      return;
    }
    vibrateTap();
    const batches = Array.from(confirmedBatches.values()).map((s) => ({
      batchId: s.batch.id,
      quantity: s.quantity,
    }));
    await onConfirm(batches, undefined);
  }, [confirmedBatches, onConfirm]);

  // === RENDER HELPERS ===

  const renderBatchCard = (batch: AvailableBatch) => {
    const effectiveAvail = getEffectiveAvailable(batch);
    const isAlreadyPicked = confirmedBatches.has(batch.id);
    const pickedQty = confirmedBatches.get(batch.id)?.quantity || 0;

    return (
      <button
        key={batch.id}
        onClick={() => selectBatch(batch)}
        disabled={effectiveAvail <= 0}
        className={cn(
          'w-full p-4 rounded-lg border text-left transition-colors active:scale-[0.98]',
          isAlreadyPicked && 'border-green-300 bg-green-50',
          effectiveAvail <= 0 && 'opacity-50',
          !isAlreadyPicked && effectiveAvail > 0 && 'hover:border-primary hover:bg-primary/5 active:bg-primary/10'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-sm">
              {batch.batchNumber}
            </Badge>
            {batch.status && (
              <Badge variant="secondary" className="text-[10px]">
                {batch.status}
              </Badge>
            )}
          </div>
          <span className="text-sm font-medium">
            {effectiveAvail > 0 ? `${effectiveAvail} avail` : 'Fully picked'}
          </span>
        </div>
        {batch.location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <MapPin className="h-3.5 w-3.5" />
            {batch.location}
          </div>
        )}
        {isAlreadyPicked && (
          <div className="flex items-center gap-1 text-sm text-green-600 mt-1">
            <Check className="h-3.5 w-3.5" />
            {pickedQty} picked
          </div>
        )}
      </button>
    );
  };

  // === MAIN CONTENT ===

  const renderContent = () => (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-5 w-5 shrink-0" />
            <span className="font-semibold truncate">{productName}</span>
          </div>
          <span className="text-sm font-medium shrink-0 ml-2">
            {totalPicked}/{targetQty}
          </span>
        </div>
        <Progress
          value={progress}
          className={cn(
            'h-2 mt-2',
            isComplete && '[&>div]:bg-green-500',
            isShortPick && '[&>div]:bg-amber-500'
          )}
        />
        {remaining > 0 && (
          <p className="text-sm text-amber-600 mt-1">{remaining} remaining</p>
        )}
        {isComplete && (
          <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
            <Check className="h-3.5 w-3.5" />
            Target met
          </p>
        )}
      </div>

      {/* Tab Selection - Two tabs only */}
      <div className="flex border-b shrink-0">
        <button
          onClick={() => { setTab('pick'); setConfirmingBatch(null); }}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
            tab === 'pick'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground'
          )}
        >
          <Camera className="h-4 w-4" />
          Pick
        </button>
        <button
          onClick={() => { setTab('search'); setConfirmingBatch(null); }}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
            tab === 'search'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground'
          )}
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Error Banner */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Quantity Confirmation Overlay */}
        {confirmingBatch && (
          <div className="px-4 py-4 bg-primary/5 border-b">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <Badge variant="outline" className="font-mono">
                    {confirmingBatch.batchNumber}
                  </Badge>
                </div>
                {confirmingBatch.location && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {confirmingBatch.location}
                  </p>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {getEffectiveAvailable(confirmingBatch)} available
              </span>
            </div>

            <p className="text-sm font-medium mb-2">How many?</p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-14 w-14 shrink-0"
                onClick={() => {
                  vibrateTap();
                  const current = parseInt(confirmQty, 10) || 0;
                  if (current > 1) setConfirmQty(String(current - 1));
                }}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <Input
                ref={qtyInputRef}
                type="number"
                inputMode="numeric"
                value={confirmQty}
                onChange={(e) => setConfirmQty(e.target.value)}
                className="h-14 text-center text-2xl font-bold flex-1"
                min={1}
                max={getEffectiveAvailable(confirmingBatch)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmBatchPick();
                }}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-14 w-14 shrink-0"
                onClick={() => {
                  vibrateTap();
                  const current = parseInt(confirmQty, 10) || 0;
                  const max = getEffectiveAvailable(confirmingBatch);
                  if (current < max) setConfirmQty(String(current + 1));
                }}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                className="flex-1 h-14"
                onClick={() => {
                  setConfirmingBatch(null);
                  setConfirmQty('');
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-14 text-base bg-green-600 hover:bg-green-700"
                onClick={confirmBatchPick}
                disabled={!confirmQty || parseInt(confirmQty, 10) <= 0}
              >
                <Check className="h-5 w-5 mr-2" />
                Confirm {confirmQty || 0}
              </Button>
            </div>
          </div>
        )}

        {/* Pick Tab: Scanner + Batch List */}
        {tab === 'pick' && !confirmingBatch && (
          <div>
            {/* Scanner */}
            <div className="p-4 border-b">
              <ScannerClient onDecoded={handleScan} />
            </div>

            {/* Divider */}
            <div className="px-4 py-2 text-center text-xs text-muted-foreground border-b bg-muted/30">
              or tap a batch below
            </div>

            {/* Available Batch List */}
            <div className="px-4 py-3">
              {loadingBatches ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : availableBatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                  <p className="font-medium">No batches available</p>
                  <p className="text-sm text-muted-foreground">
                    No stock found for this item
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableBatches.map(renderBatchCard)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search Tab */}
        {tab === 'search' && !confirmingBatch && (
          <div>
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by batch number, variety, location..."
                  className="pl-10 h-12"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-4 py-3">
              {loadingBatches ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : availableBatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Search className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'No batches found' : 'Type to search batches'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableBatches.map(renderBatchCard)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmed Picks Summary */}
      {confirmedBatches.size > 0 && !confirmingBatch && (
        <div className="border-t px-4 py-3 bg-muted/50 shrink-0">
          <p className="text-xs font-medium text-muted-foreground mb-2">Picked batches</p>
          <div className="flex flex-wrap gap-2">
            {Array.from(confirmedBatches.values()).map(({ batch, quantity }) => (
              <Badge key={batch.id} variant="secondary" className="py-1.5 px-2.5 text-sm">
                {batch.batchNumber}: {quantity}
                <button
                  onClick={() => removeConfirmedBatch(batch.id)}
                  className="ml-1.5 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {!confirmingBatch && (
        <div
          className="border-t p-4 shrink-0 bg-background"
          style={{ paddingBottom: isDesktop ? '1rem' : 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          {isShortPick && (
            <div className="flex items-center gap-1 text-xs text-amber-600 mb-2">
              <AlertTriangle className="h-3 w-3" />
              Short pick — {remaining} units short
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-14"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className={cn(
                'flex-1 h-14 text-base gap-2',
                isComplete && 'bg-green-600 hover:bg-green-700',
                isShortPick && 'bg-amber-600 hover:bg-amber-700'
              )}
              onClick={handleSubmit}
              disabled={isSubmitting || confirmedBatches.size === 0}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              {isComplete
                ? `Done ${totalPicked}`
                : isShortPick
                ? `Short ${totalPicked}/${targetQty}`
                : `Pick ${totalPicked}`}
            </Button>
          </div>
        </div>
      )}
    </>
  );

  // Responsive: Sheet on mobile, Dialog on desktop
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <VisuallyHidden>
            <DialogTitle>Pick batches for {productName}</DialogTitle>
          </VisuallyHidden>
          {renderContent()}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0" hideCloseButton>
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
}

export default BatchPicker;
