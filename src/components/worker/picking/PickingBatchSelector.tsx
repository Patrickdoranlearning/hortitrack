"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess, vibrateError } from "@/lib/haptics";
import ScannerClient from "@/components/Scanner/ScannerClient";
import type { BatchPick } from "@/server/sales/picking";

interface AvailableBatch {
  id: string;
  batchNumber: string;
  quantity: number;
  location: string;
  status?: string;
  productName?: string;
  shelfQuantity?: number;
}

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
  const [mode, setMode] = useState<"list" | "scan" | "type" | "search">("list");
  const [availableBatches, setAvailableBatches] = useState<AvailableBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [manualBatchNumber, setManualBatchNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatches, setSelectedBatches] = useState<Map<string, { batch: AvailableBatch; quantity: number }>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [customQtyBatch, setCustomQtyBatch] = useState<AvailableBatch | null>(null);
  const [customQtyValue, setCustomQtyValue] = useState<string>("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate total picked
  const totalPicked = Array.from(selectedBatches.values()).reduce((sum, b) => sum + b.quantity, 0);
  const remaining = targetQty - totalPicked;

  // Initialize selected batches from current picks
  useEffect(() => {
    if (open && currentPicks.length > 0) {
      const initialSelections = new Map<string, { batch: AvailableBatch; quantity: number }>();
      for (const pick of currentPicks) {
        initialSelections.set(pick.batchId, {
          batch: {
            id: pick.batchId,
            batchNumber: pick.batchNumber,
            quantity: pick.quantity,
            location: pick.location || "",
          },
          quantity: pick.quantity,
        });
      }
      setSelectedBatches(initialSelections);
    } else if (open) {
      setSelectedBatches(new Map());
    }
  }, [open, currentPicks]);

  // Fetch available batches
  const fetchAvailableBatches = useCallback(async () => {
    setLoadingBatches(true);
    setError(null);
    try {
      const res = await fetch(`/api/picking/${pickListId}/items/${itemId}/batches?includePicks=true`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.batches) {
        setAvailableBatches(data.batches);
      }
    } catch {
      setError("Failed to load batches");
    } finally {
      setLoadingBatches(false);
    }
  }, [pickListId, itemId]);

  // Initial fetch when opened
  useEffect(() => {
    if (open) {
      fetchAvailableBatches();
      setMode("list");
      setManualBatchNumber("");
      setSearchQuery("");
    }
  }, [open, fetchAvailableBatches]);

  // Search with debounce
  useEffect(() => {
    if (mode !== "search" || !searchQuery.trim()) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoadingBatches(true);
      try {
        const res = await fetch(`/api/batches/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
        const data = await res.json();
        if (data.batches) {
          setAvailableBatches(data.batches.map((b: any) => ({
            id: b.id,
            batchNumber: b.batch_number,
            quantity: b.quantity || 0,
            location: b.location_name || "",
            status: b.status,
          })));
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
  const handleScan = (scannedText: string) => {
    vibrateTap();
    // Parse batch code - expected format: ht:batch:XXXX or just XXXX
    let batchNumber = scannedText;
    if (scannedText.startsWith("ht:batch:")) {
      batchNumber = scannedText.slice(9);
    } else if (scannedText.startsWith("BATCH:")) {
      batchNumber = scannedText.slice(6);
    }

    // Find matching batch
    const matchingBatch = availableBatches.find(
      (b) => b.batchNumber.toLowerCase() === batchNumber.toLowerCase()
    );

    if (matchingBatch) {
      vibrateSuccess();
      addBatch(matchingBatch, Math.min(matchingBatch.quantity, remaining));
      setMode("list");
    } else {
      vibrateError();
      setError(`Batch ${batchNumber} not found or not available for this item`);
      setMode("list");
    }
  };

  // Handle manual batch entry
  const handleManualEntry = () => {
    if (!manualBatchNumber.trim()) return;
    vibrateTap();

    const matchingBatch = availableBatches.find(
      (b) => b.batchNumber.toLowerCase() === manualBatchNumber.toLowerCase()
    );

    if (matchingBatch) {
      vibrateSuccess();
      addBatch(matchingBatch, Math.min(matchingBatch.quantity, remaining));
      setManualBatchNumber("");
      setMode("list");
    } else {
      vibrateError();
      setError(`Batch ${manualBatchNumber} not found`);
    }
  };

  // Add or update a batch selection
  const addBatch = (batch: AvailableBatch, qty: number) => {
    if (qty <= 0) return;
    setSelectedBatches((prev) => {
      const next = new Map(prev);
      const existing = next.get(batch.id);
      if (existing) {
        next.set(batch.id, { batch, quantity: existing.quantity + qty });
      } else {
        next.set(batch.id, { batch, quantity: qty });
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
        next.set(batchId, { ...existing, quantity: newQty });
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

  // Quick add from list
  const handleQuickAdd = (batch: AvailableBatch) => {
    vibrateTap();
    const qtyToAdd = Math.min(batch.quantity, remaining);
    if (qtyToAdd > 0) {
      addBatch(batch, qtyToAdd);
    }
  };

  // Save selections
  const handleSave = async () => {
    if (selectedBatches.size === 0) {
      setError("Please select at least one batch");
      return;
    }

    vibrateTap();
    const batches = Array.from(selectedBatches.values()).map((s) => ({
      batchId: s.batch.id,
      quantity: s.quantity,
    }));

    await onSave(batches);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="text-left">
            Select Batches
          </SheetTitle>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{productName}</span>
            <div className="flex items-center gap-2 mt-1">
              <Package className="h-4 w-4" />
              <span>Need: {targetQty}</span>
              <span className="mx-1">|</span>
              <span className={cn(
                "font-medium",
                remaining > 0 && "text-amber-600",
                remaining === 0 && "text-green-600"
              )}>
                Remaining: {remaining}
              </span>
            </div>
          </div>
        </SheetHeader>

        {/* Mode Selection Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setMode("list")}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              mode === "list"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            )}
          >
            Available
          </button>
          <button
            onClick={() => setMode("scan")}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1",
              mode === "scan"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            )}
          >
            <Camera className="h-4 w-4" />
            Scan
          </button>
          <button
            onClick={() => setMode("type")}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1",
              mode === "type"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            )}
          >
            <Keyboard className="h-4 w-4" />
            Type
          </button>
          <button
            onClick={() => setMode("search")}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1",
              mode === "search"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
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
          {mode === "scan" && (
            <div className="p-4">
              <ScannerClient
                onDecoded={handleScan}
              />
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setMode("list")}
              >
                Cancel Scan
              </Button>
            </div>
          )}

          {/* Type Mode */}
          {mode === "type" && (
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
          {mode === "search" && (
            <div className="p-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by variety name..."
                  className="pl-10 h-12"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Batch List (shown in list, search, and type modes) */}
          {(mode === "list" || mode === "search" || mode === "type") && (
            <div className="px-4 pb-4">
              {loadingBatches ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : availableBatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {mode === "search" && searchQuery
                    ? "No batches found"
                    : "No available batches"}
                </div>
              ) : (
                <div className="space-y-2">
                  {availableBatches.map((batch) => {
                    const isSelected = selectedBatches.has(batch.id);
                    const selectedQty = selectedBatches.get(batch.id)?.quantity || 0;

                    return (
                      <div
                        key={batch.id}
                        className={cn(
                          "p-3 rounded-lg border transition-colors",
                          isSelected && "border-primary bg-primary/5"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="font-mono text-sm">
                            {batch.batchNumber}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {batch.quantity} available
                          </span>
                        </div>
                        {batch.location && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                            <MapPin className="h-3.5 w-3.5" />
                            {batch.location}
                          </div>
                        )}

                        {isSelected ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10"
                              onClick={() => updateBatchQty(batch.id, -1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="flex-1 text-center text-lg font-medium">
                              {selectedQty}
                            </span>
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
                              className="h-10 w-10 text-destructive"
                              onClick={() => removeBatch(batch.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : customQtyBatch?.id === batch.id ? (
                          /* Custom quantity input mode */
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
                              max={Math.min(batch.quantity, remaining)}
                            />
                            <Button
                              variant="default"
                              className="h-10 flex-1"
                              onClick={() => {
                                const qty = parseInt(customQtyValue, 10);
                                if (qty > 0 && qty <= Math.min(batch.quantity, remaining)) {
                                  vibrateTap();
                                  addBatch(batch, qty);
                                  setCustomQtyBatch(null);
                                  setCustomQtyValue("");
                                }
                              }}
                              disabled={!customQtyValue || parseInt(customQtyValue, 10) <= 0}
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
                                setCustomQtyValue("");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          /* Shelf picking options: Half Shelf, Full Shelf, Custom */
                          (() => {
                            // Use shelf quantity from product/size config, fallback to reasonable default
                            const shelfQty = batch.shelfQuantity || 20;
                            const halfShelfQty = Math.floor(shelfQty / 2);
                            // Clamp to what's available and what's remaining
                            const effectiveFullShelf = Math.min(shelfQty, batch.quantity, remaining);
                            const effectiveHalfShelf = Math.min(halfShelfQty, batch.quantity, remaining);

                            return (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  className="flex-1 h-12"
                                  onClick={() => {
                                    vibrateTap();
                                    if (effectiveHalfShelf > 0) addBatch(batch, effectiveHalfShelf);
                                  }}
                                  disabled={remaining <= 0 || effectiveHalfShelf <= 0}
                                >
                                  <span className="text-xs leading-tight text-center">
                                    Half Shelf<br />
                                    <span className="font-semibold">{effectiveHalfShelf}</span>
                                  </span>
                                </Button>
                                <Button
                                  variant="secondary"
                                  className="flex-1 h-12"
                                  onClick={() => {
                                    vibrateTap();
                                    if (effectiveFullShelf > 0) addBatch(batch, effectiveFullShelf);
                                  }}
                                  disabled={remaining <= 0 || effectiveFullShelf <= 0}
                                >
                                  <span className="text-xs leading-tight text-center">
                                    Full Shelf<br />
                                    <span className="font-semibold">{effectiveFullShelf}</span>
                                  </span>
                                </Button>
                                <Button
                                  variant="outline"
                                  className="flex-1 h-12"
                                  onClick={() => {
                                    vibrateTap();
                                    setCustomQtyBatch(batch);
                                    setCustomQtyValue("");
                                  }}
                                  disabled={remaining <= 0}
                                >
                                  <span className="text-xs leading-tight text-center">
                                    Custom<br />
                                    <span className="font-semibold">...</span>
                                  </span>
                                </Button>
                              </div>
                            );
                          })()
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
            <Label className="text-sm font-medium mb-2 block">Selected Batches</Label>
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedBatches.values()).map(({ batch, quantity }) => (
                <Badge
                  key={batch.id}
                  variant="secondary"
                  className="py-1 px-2 text-sm"
                >
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

        {/* Bottom Action */}
        <div
          className="border-t p-4 shrink-0 bg-background"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">
              Total: {totalPicked} / {targetQty}
            </span>
            {remaining > 0 && (
              <span className="text-sm text-amber-600">
                {remaining} more needed
              </span>
            )}
            {remaining === 0 && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <Check className="h-4 w-4" />
                Complete
              </span>
            )}
          </div>
          <Button
            size="lg"
            className={cn(
              "w-full h-14 text-lg gap-2",
              totalPicked >= targetQty && "bg-green-600 hover:bg-green-700"
            )}
            onClick={handleSave}
            disabled={isSubmitting || selectedBatches.size === 0}
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            {totalPicked >= targetQty ? "Confirm Pick" : `Pick ${totalPicked} (Short)`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
