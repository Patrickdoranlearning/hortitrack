"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ScanLine,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { parseLotScanCode } from "@/lib/scan/parse";
import { LotSelectionCombobox, type AvailableLot } from "@/components/materials/LotSelectionCombobox";

const ScannerClient = dynamic(
  () => import("@/components/Scanner/ScannerClient"),
  {
    ssr: false,
    loading: () => <Skeleton className="aspect-video w-full rounded-lg" />,
  }
);

type ChecklistItem = {
  materialId: string;
  materialName: string;
  partNumber: string;
  baseUom: string;
  quantityPlanned: number;
  quantityConsumed: number;
  status: "pending" | "confirmed" | "partial";
};

interface MaterialConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  material: ChecklistItem | null;
  onSuccess: () => void;
}

type InputMode = "choose" | "scan" | "search";

type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "searching"; code: string }
  | { status: "found"; lot: LotSearchResult }
  | { status: "not_found"; code: string }
  | { status: "error"; message: string };

type LotSearchResult = {
  id: string;
  lotNumber: string;
  materialId: string;
  materialName: string;
  currentQuantity: number;
  uom: string;
};

export function MaterialConfirmDialog({
  open,
  onOpenChange,
  batchId,
  material,
  onSuccess,
}: MaterialConfirmDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<InputMode>("choose");
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [selectedLot, setSelectedLot] = useState<AvailableLot | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  const remaining = material
    ? material.quantityPlanned - material.quantityConsumed
    : 0;

  // Reset state when dialog opens/material changes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen && material) {
        setMode("choose");
        setScanState({ status: "idle" });
        setSelectedLot(null);
        setQuantity(Math.max(0, material.quantityPlanned - material.quantityConsumed));
        setMismatch(false);
      }
      onOpenChange(newOpen);
    },
    [material, onOpenChange]
  );

  // Handle barcode scan
  const handleDecode = useCallback(
    async (code: string) => {
      if (!material) return;

      const parsed = parseLotScanCode(code);
      if (!parsed) {
        setScanState({ status: "not_found", code });
        return;
      }

      setScanState({ status: "searching", code });

      try {
        const params = new URLSearchParams({
          [parsed.by]: parsed.value,
          materialId: material.materialId,
        });
        const res = await fetch(`/api/materials/lots/search?${params}`);
        if (!res.ok) {
          setScanState({ status: "error", message: "Search failed" });
          return;
        }

        const data = await res.json();
        const lots = data.lots ?? data.results ?? [];

        if (lots.length > 0) {
          const lot = lots[0];
          const lotMaterialId = lot.material_id ?? lot.materialId;
          const isMismatch = lotMaterialId !== material.materialId;
          setMismatch(isMismatch);

          setScanState({
            status: "found",
            lot: {
              id: lot.id ?? lot.lotId,
              lotNumber: lot.lot_number ?? lot.lotNumber,
              materialId: lotMaterialId,
              materialName: lot.material_name ?? lot.materialName ?? material.materialName,
              currentQuantity: Number(lot.current_quantity ?? lot.currentQuantity ?? 0),
              uom: lot.uom ?? material.baseUom,
            },
          });
        } else {
          setScanState({ status: "not_found", code });
        }
      } catch (err) {
        setScanState({
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [material]
  );

  // Handle lot selection from combobox
  const handleLotSelect = useCallback(
    (lot: AvailableLot | null) => {
      setSelectedLot(lot);
      if (lot) {
        setMismatch(false); // Combobox filters by materialId, no mismatch possible
      }
    },
    []
  );

  // Submit confirmation
  const handleSubmit = useCallback(async () => {
    if (!material || !batchId) return;

    let lotId: string | undefined;

    if (mode === "scan" && scanState.status === "found") {
      lotId = scanState.lot.id;
    } else if (mode === "search" && selectedLot) {
      lotId = selectedLot.lotId;
    }

    if (!lotId) {
      toast({
        title: "No lot selected",
        description: "Please scan or select a lot first.",
        variant: "destructive",
      });
      return;
    }

    if (quantity <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Quantity must be greater than 0.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/worker/batches/${batchId}/materials/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId,
          materialId: material.materialId,
          quantity,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to confirm material");
      }

      vibrateSuccess();
      toast({
        title: "Material Confirmed",
        description: `${material.materialName}: ${quantity} ${material.baseUom} confirmed.`,
      });
      onSuccess();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to confirm",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }, [material, batchId, mode, scanState, selectedLot, quantity, toast, onSuccess]);

  if (!material) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Material</DialogTitle>
          <DialogDescription>
            {material.materialName} ({material.partNumber})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Material info */}
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Planned</span>
              <span className="font-medium">
                {material.quantityPlanned.toLocaleString()} {material.baseUom}
              </span>
            </div>
            {material.quantityConsumed > 0 && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Already confirmed</span>
                <span>{material.quantityConsumed.toLocaleString()} {material.baseUom}</span>
              </div>
            )}
            <div className="flex justify-between text-sm mt-1 font-medium">
              <span>Remaining</span>
              <span>{remaining.toLocaleString()} {material.baseUom}</span>
            </div>
          </div>

          {/* Input mode selection */}
          {mode === "choose" && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center gap-2"
                onClick={() => {
                  vibrateTap();
                  setMode("scan");
                  setScanState({ status: "scanning" });
                }}
              >
                <ScanLine className="h-6 w-6" />
                <span className="text-sm">Scan Barcode</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center gap-2"
                onClick={() => {
                  vibrateTap();
                  setMode("search");
                }}
              >
                <Search className="h-6 w-6" />
                <span className="text-sm">Search Lots</span>
              </Button>
            </div>
          )}

          {/* Scanner mode */}
          {mode === "scan" && (
            <div className="space-y-3">
              {(scanState.status === "scanning" || scanState.status === "searching") && (
                <ScannerClient onDecoded={handleDecode} roiScale={0.75} />
              )}

              {scanState.status === "searching" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking up: {scanState.code}
                </div>
              )}

              {scanState.status === "found" && (
                <div className="space-y-3">
                  <div
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      mismatch
                        ? "border-amber-200 bg-amber-50"
                        : "border-green-200 bg-green-50"
                    }`}
                  >
                    {mismatch ? (
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {scanState.lot.lotNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {scanState.lot.materialName}
                      </p>
                      <p className="text-xs mt-1">
                        Available: {scanState.lot.currentQuantity.toLocaleString()}{" "}
                        {scanState.lot.uom}
                      </p>
                      {mismatch && (
                        <Badge variant="destructive" className="mt-2 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Different material than planned
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Quantity input */}
                  <div>
                    <Label>Quantity ({material.baseUom})</Label>
                    <Input
                      type="number"
                      min={1}
                      max={scanState.lot.currentQuantity}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 0))}
                      className="mt-1"
                    />
                    {quantity > scanState.lot.currentQuantity && (
                      <p className="text-xs text-destructive mt-1">
                        Exceeds available quantity ({scanState.lot.currentQuantity})
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setScanState({ status: "scanning" });
                        setMismatch(false);
                      }}
                    >
                      Scan Another
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSubmit}
                      disabled={submitting || quantity <= 0}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Confirm
                    </Button>
                  </div>
                </div>
              )}

              {scanState.status === "not_found" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-amber-900">Lot not found</p>
                      <p className="text-xs text-amber-700">
                        Code: {scanState.code}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setMode("choose")}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => setScanState({ status: "scanning" })}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {scanState.status === "error" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-red-900">Error</p>
                      <p className="text-xs text-red-700">{scanState.message}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setMode("choose")}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => setScanState({ status: "scanning" })}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search mode */}
          {mode === "search" && (
            <div className="space-y-3">
              <div>
                <Label>Select Lot (FIFO order)</Label>
                <div className="mt-1">
                  <LotSelectionCombobox
                    materialId={material.materialId}
                    requiredQuantity={remaining}
                    value={selectedLot?.lotId ?? null}
                    onChange={handleLotSelect}
                    showFifoSuggestion
                  />
                </div>
              </div>

              {selectedLot && (
                <>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="font-medium text-sm">{selectedLot.lotNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Available: {selectedLot.currentQuantity.toLocaleString()}
                      {selectedLot.isSuggested && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          FIFO Recommended
                        </Badge>
                      )}
                    </p>
                  </div>

                  <div>
                    <Label>Quantity ({material.baseUom})</Label>
                    <Input
                      type="number"
                      min={1}
                      max={selectedLot.currentQuantity}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 0))}
                      className="mt-1"
                    />
                    {quantity > selectedLot.currentQuantity && (
                      <p className="text-xs text-destructive mt-1">
                        Exceeds available ({selectedLot.currentQuantity})
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMode("choose");
                    setSelectedLot(null);
                  }}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={submitting || !selectedLot || quantity <= 0}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
