'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Camera,
  Keyboard,
  Search,
  MapPin,
  Loader2,
  Plus,
  Minus,
  Check,
  X,
  Package,
  Info,
  AlertTriangle,
  List,
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

type InputMode = 'list' | 'scan' | 'type' | 'search';

// ============================================================================
// HOOK: useMediaQuery for responsive behavior
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
// COMPONENT: BatchPicker
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
  const [mode, setMode] = useState<InputMode>('list');
  const [availableBatches, setAvailableBatches] = useState<AvailableBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [manualBatchNumber, setManualBatchNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatches, setSelectedBatches] = useState<Map<string, BatchSelection>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [customQtyBatch, setCustomQtyBatch] = useState<AvailableBatch | null>(null);
  const [customQtyValue, setCustomQtyValue] = useState('');
  const [notes, setNotes] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate totals
  const totalPicked = useMemo(() => {
    let sum = 0;
    selectedBatches.forEach((s) => {
      sum += s.quantity;
    });
    return sum;
  }, [selectedBatches]);

  const remaining = targetQty - totalPicked;
  const progress = targetQty > 0 ? Math.min(100, Math.round((totalPicked / targetQty) * 100)) : 0;
  const isShortPick = totalPicked > 0 && totalPicked < targetQty;
  const isComplete = totalPicked >= targetQty;
  const isOverPick = totalPicked > targetQty;

  // Initialize selected batches from current picks (for editing existing picks)
  useEffect(() => {
    if (open && currentPicks.length > 0) {
      const initialSelections = new Map<string, BatchSelection>();
      for (const pick of currentPicks) {
        initialSelections.set(pick.batchId, {
          batch: {
            id: pick.batchId,
            batchNumber: pick.batchNumber,
            quantity: pick.quantity, // Available qty (would need to be fetched for accuracy)
            location: pick.location || '',
          },
          quantity: pick.quantity,
        });
      }
      setSelectedBatches(initialSelections);
    } else if (open) {
      // Always start with blank slate - no auto-fill FEFO
      setSelectedBatches(new Map());
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
        // No auto-fill - user makes their own decisions
      }
    } catch {
      setError('Failed to load batches');
    } finally {
      setLoadingBatches(false);
    }
  }, [pickListId, itemId]);

  // Initial fetch when opened
  useEffect(() => {
    if (open) {
      fetchAvailableBatches();
      setMode('list');
      setManualBatchNumber('');
      setSearchQuery('');
      setNotes('');
      setError(null);
      setCustomQtyBatch(null);
      setCustomQtyValue('');
    }
  }, [open, fetchAvailableBatches]);

  // Search with debounce
  useEffect(() => {
    if (mode !== 'search' || !searchQuery.trim()) return;

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
  }, [searchQuery, mode]);

  // Handle barcode scan
  const handleScan = useCallback(
    (scannedText: string) => {
      vibrateTap();
      // Parse batch code - expected format: ht:batch:XXXX or BATCH:XXXX or just XXXX
      let batchNumber = scannedText;
      if (scannedText.startsWith('ht:batch:')) {
        batchNumber = scannedText.slice(9);
      } else if (scannedText.startsWith('BATCH:')) {
        batchNumber = scannedText.slice(6);
      }

      // Find matching batch
      const matchingBatch = availableBatches.find(
        (b) => b.batchNumber.toLowerCase() === batchNumber.toLowerCase()
      );

      if (matchingBatch) {
        vibrateSuccess();
        const qtyToAdd = Math.min(matchingBatch.quantity, Math.max(remaining, 1));
        addBatch(matchingBatch, qtyToAdd);
        setMode('list');
      } else {
        vibrateError();
        setError(`Batch ${batchNumber} not found or not available for this item`);
        setMode('list');
      }
    },
    [availableBatches, remaining]
  );

  // Handle manual batch entry
  const handleManualEntry = useCallback(() => {
    if (!manualBatchNumber.trim()) return;
    vibrateTap();

    const matchingBatch = availableBatches.find(
      (b) => b.batchNumber.toLowerCase() === manualBatchNumber.toLowerCase()
    );

    if (matchingBatch) {
      vibrateSuccess();
      const qtyToAdd = Math.min(matchingBatch.quantity, Math.max(remaining, 1));
      addBatch(matchingBatch, qtyToAdd);
      setManualBatchNumber('');
      setMode('list');
    } else {
      vibrateError();
      setError(`Batch ${manualBatchNumber} not found`);
    }
  }, [manualBatchNumber, availableBatches, remaining]);

  // Add or update a batch selection
  const addBatch = (batch: AvailableBatch, qty: number) => {
    if (qty <= 0) return;
    setSelectedBatches((prev) => {
      const next = new Map(prev);
      const existing = next.get(batch.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + qty, batch.quantity);
        next.set(batch.id, { batch, quantity: newQty });
      } else {
        next.set(batch.id, { batch, quantity: Math.min(qty, batch.quantity) });
      }
      return next;
    });
    setError(null);
  };

  // Update quantity for a batch
  const updateBatchQty = (batchId: string, delta: number) => {
    vibrateTap();
    setSelectedBatches((prev) => {
      const next = new Map(prev);
      const existing = next.get(batchId);
      if (!existing) return prev;

      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        next.delete(batchId);
      } else {
        const clampedQty = Math.min(newQty, existing.batch.quantity);
        next.set(batchId, { ...existing, quantity: clampedQty });
      }
      return next;
    });
  };

  // Set exact quantity for a batch
  const setBatchQty = (batchId: string, qty: number) => {
    vibrateTap();
    setSelectedBatches((prev) => {
      const next = new Map(prev);
      const existing = next.get(batchId);
      if (!existing) return prev;

      if (qty <= 0) {
        next.delete(batchId);
      } else {
        const clampedQty = Math.min(qty, existing.batch.quantity);
        next.set(batchId, { ...existing, quantity: clampedQty });
      }
      return next;
    });
  };

  // Remove a batch
  const removeBatch = (batchId: string) => {
    vibrateTap();
    setSelectedBatches((prev) => {
      const next = new Map(prev);
      next.delete(batchId);
      return next;
    });
  };

  // Save selections
  const handleSave = async () => {
    if (selectedBatches.size === 0) {
      setError('Please select at least one batch');
      return;
    }

    vibrateTap();
    const batches = Array.from(selectedBatches.values()).map((s) => ({
      batchId: s.batch.id,
      quantity: s.quantity,
    }));

    await onConfirm(batches, notes || undefined);
  };

  // Get the selected quantity for a batch (for display)
  const getSelectedQty = (batchId: string): number => {
    return selectedBatches.get(batchId)?.quantity || 0;
  };

  // Check if a batch is selected
  const isSelected = (batchId: string): boolean => {
    return selectedBatches.has(batchId);
  };

  // Render the picker content (shared between Sheet and Dialog)
  const renderContent = () => (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <span className="font-semibold">Select Batches</span>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          <span className="font-medium">{productName}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm">Need: {targetQty}</span>
          <span className="mx-1">|</span>
          <span
            className={cn(
              'text-sm font-medium',
              remaining > 0 && 'text-amber-600',
              remaining === 0 && 'text-green-600',
              remaining < 0 && 'text-red-600'
            )}
          >
            Remaining: {remaining}
          </span>
        </div>
        {/* Progress Bar */}
        <Progress
          value={progress}
          className={cn(
            'h-2 mt-2',
            isComplete && '[&>div]:bg-green-500',
            isShortPick && '[&>div]:bg-amber-500',
            isOverPick && '[&>div]:bg-red-500'
          )}
        />
      </div>

      {/* Mode Selection Tabs */}
      <div className="flex border-b shrink-0">
        <button
          onClick={() => setMode('list')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1',
            mode === 'list'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground'
          )}
        >
          <List className="h-4 w-4" />
          Available
        </button>
        <button
          onClick={() => setMode('scan')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1',
            mode === 'scan'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground'
          )}
        >
          <Camera className="h-4 w-4" />
          Scan
        </button>
        <button
          onClick={() => setMode('type')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1',
            mode === 'type'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground'
          )}
        >
          <Keyboard className="h-4 w-4" />
          Type
        </button>
        <button
          onClick={() => setMode('search')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1',
            mode === 'search'
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

        {/* Scan Mode */}
        {mode === 'scan' && (
          <div className="p-4">
            <ScannerClient onDecoded={handleScan} />
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => setMode('list')}
            >
              Cancel Scan
            </Button>
          </div>
        )}

        {/* Type Mode */}
        {mode === 'type' && (
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Enter Batch Number</Label>
              <div className="flex gap-2">
                <Input
                  value={manualBatchNumber}
                  onChange={(e) => setManualBatchNumber(e.target.value.toUpperCase())}
                  placeholder="e.g., B2024-0892"
                  className="flex-1 h-12 text-lg font-mono"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleManualEntry();
                    }
                  }}
                />
                <Button
                  onClick={handleManualEntry}
                  disabled={!manualBatchNumber.trim()}
                  className="h-12 px-6"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Search Mode */}
        {mode === 'search' && (
          <div className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by variety, batch number..."
                className="pl-10 h-12"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Batch List (shown in list, search, and type modes) */}
        {(mode === 'list' || mode === 'search' || mode === 'type') && (
          <div className="px-4 pb-4">
            {loadingBatches ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableBatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                <p className="font-medium">No batches available</p>
                <p className="text-sm text-muted-foreground">
                  {mode === 'search' && searchQuery
                    ? 'No batches found matching your search'
                    : 'There are no batches with available stock for this item'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {availableBatches.map((batch) => {
                  const selected = isSelected(batch.id);
                  const selectedQty = getSelectedQty(batch.id);

                  // Calculate shelf quantities
                  const shelfQty = batch.shelfQuantity || 20;
                  const halfShelfQty = Math.floor(shelfQty / 2);
                  const effectiveRemaining = Math.max(0, remaining);
                  const effectiveFullShelf = Math.min(
                    shelfQty,
                    batch.quantity,
                    effectiveRemaining > 0 ? effectiveRemaining : batch.quantity
                  );
                  const effectiveHalfShelf = Math.min(
                    halfShelfQty,
                    batch.quantity,
                    effectiveRemaining > 0 ? effectiveRemaining : batch.quantity
                  );

                  return (
                    <div
                      key={batch.id}
                      className={cn(
                        'p-3 rounded-lg border transition-colors',
                        selected && 'border-primary bg-primary/5'
                      )}
                    >
                      {/* Batch Header */}
                      <div className="flex items-center justify-between mb-2">
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
                        <span className="text-sm text-muted-foreground">
                          {batch.quantity} available
                        </span>
                      </div>

                      {/* Location */}
                      {batch.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                          <MapPin className="h-3.5 w-3.5" />
                          {batch.location}
                        </div>
                      )}

                      {/* Controls */}
                      {selected ? (
                        // Already selected - show quantity controls
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => updateBatchQty(batch.id, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            value={selectedQty}
                            onChange={(e) =>
                              setBatchQty(batch.id, parseInt(e.target.value) || 0)
                            }
                            className="h-10 w-20 text-center text-lg font-medium"
                            min={1}
                            max={batch.quantity}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => updateBatchQty(batch.id, 1)}
                            disabled={selectedQty >= batch.quantity}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-destructive hover:text-destructive"
                            onClick={() => removeBatch(batch.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : customQtyBatch?.id === batch.id ? (
                        // Custom quantity input mode
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={customQtyValue}
                            onChange={(e) => setCustomQtyValue(e.target.value)}
                            placeholder="Qty"
                            className="h-10 w-24 text-center text-lg"
                            autoFocus
                            min={1}
                            max={batch.quantity}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const qty = parseInt(customQtyValue, 10);
                                if (qty > 0 && qty <= batch.quantity) {
                                  vibrateTap();
                                  addBatch(batch, qty);
                                  setCustomQtyBatch(null);
                                  setCustomQtyValue('');
                                }
                              }
                            }}
                          />
                          <Button
                            variant="default"
                            className="h-10 flex-1"
                            onClick={() => {
                              const qty = parseInt(customQtyValue, 10);
                              if (qty > 0 && qty <= batch.quantity) {
                                vibrateTap();
                                addBatch(batch, qty);
                                setCustomQtyBatch(null);
                                setCustomQtyValue('');
                              }
                            }}
                            disabled={
                              !customQtyValue || parseInt(customQtyValue, 10) <= 0
                            }
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => {
                              setCustomQtyBatch(null);
                              setCustomQtyValue('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        // Not selected - show quick pick buttons
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1 h-12"
                            onClick={() => {
                              vibrateTap();
                              if (effectiveHalfShelf > 0) {
                                addBatch(batch, effectiveHalfShelf);
                              }
                            }}
                            disabled={batch.quantity <= 0 || effectiveHalfShelf <= 0}
                          >
                            <span className="text-xs leading-tight text-center">
                              Half Shelf
                              <br />
                              <span className="font-semibold">{effectiveHalfShelf}</span>
                            </span>
                          </Button>
                          <Button
                            variant="secondary"
                            className="flex-1 h-12"
                            onClick={() => {
                              vibrateTap();
                              if (effectiveFullShelf > 0) {
                                addBatch(batch, effectiveFullShelf);
                              }
                            }}
                            disabled={batch.quantity <= 0 || effectiveFullShelf <= 0}
                          >
                            <span className="text-xs leading-tight text-center">
                              Full Shelf
                              <br />
                              <span className="font-semibold">{effectiveFullShelf}</span>
                            </span>
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 h-12"
                            onClick={() => {
                              vibrateTap();
                              setCustomQtyBatch(batch);
                              setCustomQtyValue('');
                            }}
                            disabled={batch.quantity <= 0}
                          >
                            <span className="text-xs leading-tight text-center">
                              Custom
                              <br />
                              <span className="font-semibold">...</span>
                            </span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Batches Summary */}
      {selectedBatches.size > 0 && (
        <div className="border-t px-4 py-3 bg-muted/50 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Selected Batches</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Batch Breakdown</p>
                  {Array.from(selectedBatches.values()).map((s) => (
                    <div key={s.batch.id} className="flex justify-between">
                      <span className="font-mono text-xs">{s.batch.batchNumber}</span>
                      <span>{s.quantity} units</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Total</span>
                    <span>{totalPicked} units</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedBatches.values()).map(({ batch, quantity }) => (
              <Badge key={batch.id} variant="secondary" className="py-1 px-2 text-sm">
                {batch.batchNumber}: {quantity}
                <button
                  onClick={() => removeBatch(batch.id)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notes Field (optional) */}
      {selectedBatches.size > 0 && (
        <div className="px-4 py-2 border-t shrink-0">
          <Label className="text-sm font-medium mb-1.5 block">Notes (optional)</Label>
          <Input
            placeholder="Add any notes about this pick..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      )}

      {/* Bottom Action */}
      <div
        className="border-t p-4 shrink-0 bg-background"
        style={{ paddingBottom: isDesktop ? '1rem' : 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {/* Warnings */}
        {isShortPick && (
          <div className="flex items-center gap-1 text-xs text-amber-600 mb-2">
            <AlertTriangle className="h-3 w-3" />
            Short pick - {targetQty - totalPicked} units short
          </div>
        )}
        {isOverPick && (
          <div className="flex items-center gap-1 text-xs text-red-600 mb-2">
            <AlertTriangle className="h-3 w-3" />
            Over-picking by {totalPicked - targetQty} units
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">
            Total: {totalPicked} / {targetQty}
          </span>
          {isComplete && !isOverPick && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <Check className="h-4 w-4" />
              Complete
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            size="lg"
            className={cn(
              'flex-1 gap-2',
              isComplete && !isOverPick && 'bg-green-600 hover:bg-green-700',
              isShortPick && 'bg-amber-600 hover:bg-amber-700'
            )}
            onClick={handleSave}
            disabled={isSubmitting || selectedBatches.size === 0}
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            {isComplete && !isOverPick
              ? 'Confirm Pick'
              : isShortPick
              ? `Confirm Short (${totalPicked})`
              : `Pick ${totalPicked}`}
          </Button>
        </div>
      </div>
    </>
  );

  // Render as Sheet on mobile, Dialog on desktop
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
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
