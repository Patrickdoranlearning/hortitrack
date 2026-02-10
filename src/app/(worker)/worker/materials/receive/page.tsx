"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { vibrateTap, vibrateSuccess, vibrateError } from "@/lib/haptics";
import {
  MaterialSearchSheet,
  type MaterialSearchResult,
} from "@/components/worker/materials/MaterialSearchSheet";

type LotEntry = {
  id: string;
  quantity: number;
  unitType: "box" | "bag" | "pallet" | "roll" | "bundle" | "unit";
  unitsPerPackage?: number;
  supplierLotNumber?: string;
  expiryDate?: string;
  notes?: string;
};

type CreatedLot = {
  id: string;
  lotNumber: string;
  lotBarcode: string;
  quantity: number;
  uom: string;
  unitType: string;
};

const UNIT_TYPES = [
  { value: "box", label: "Box" },
  { value: "bag", label: "Bag" },
  { value: "pallet", label: "Pallet" },
  { value: "roll", label: "Roll" },
  { value: "bundle", label: "Bundle" },
  { value: "unit", label: "Unit" },
] as const;

export default function WorkerReceiveMaterialsPage() {
  const [step, setStep] = useState(1);
  const [materialSheetOpen, setMaterialSheetOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialSearchResult | null>(
    null
  );
  const [lots, setLots] = useState<LotEntry[]>([
    { id: "1", quantity: 0, unitType: "box" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [createdLots, setCreatedLots] = useState<CreatedLot[]>([]);

  const addLot = () => {
    vibrateTap();
    setLots((prev) => [
      ...prev,
      { id: String(Date.now()), quantity: 0, unitType: "box" },
    ]);
  };

  const removeLot = (id: string) => {
    vibrateTap();
    setLots((prev) => prev.filter((lot) => lot.id !== id));
  };

  const updateLot = (id: string, updates: Partial<LotEntry>) => {
    setLots((prev) =>
      prev.map((lot) => (lot.id === id ? { ...lot, ...updates } : lot))
    );
  };

  const handleSubmit = async () => {
    if (!selectedMaterial || lots.length === 0) return;

    vibrateTap();
    setSubmitting(true);
    try {
      const res = await fetch("/api/worker/materials/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: selectedMaterial.id,
          lots: lots
            .filter((lot) => lot.quantity > 0)
            .map((lot) => ({
              quantity: lot.quantity,
              unitType: lot.unitType,
              unitsPerPackage: lot.unitsPerPackage || undefined,
              supplierLotNumber: lot.supplierLotNumber || undefined,
              expiryDate: lot.expiryDate || undefined,
              notes: lot.notes || undefined,
            })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to receive materials");
      }

      const data = await res.json();
      setCreatedLots(data.lots);
      vibrateSuccess();
      setStep(3);
    } catch (error) {
      vibrateError();
      toast.error(error instanceof Error ? error.message : "Failed to receive materials");
    } finally {
      setSubmitting(false);
    }
  };

  const totalQuantity = lots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);
  const hasValidLots = lots.some((lot) => lot.quantity > 0);

  const resetForm = () => {
    setStep(1);
    setSelectedMaterial(null);
    setLots([{ id: "1", quantity: 0, unitType: "box" }]);
    setCreatedLots([]);
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/worker/materials">
            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h2 className="text-lg font-semibold flex-1">Receive Delivery</h2>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mt-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-0.5 mx-2 ${
                    step > s ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-8 text-xs text-muted-foreground mt-2">
          <span className={step >= 1 ? "text-foreground font-medium" : ""}>
            Select
          </span>
          <span className={step >= 2 ? "text-foreground font-medium" : ""}>
            Enter Lots
          </span>
          <span className={step >= 3 ? "text-foreground font-medium" : ""}>
            Done
          </span>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Step 1: Select Material */}
        {step === 1 && (
          <>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label className="text-base">Material</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Select the material you are receiving
                  </p>

                  <Button
                    variant="outline"
                    className="w-full justify-between h-14 text-left"
                    onClick={() => setMaterialSheetOpen(true)}
                  >
                    {selectedMaterial ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Package className="h-5 w-5 flex-shrink-0" />
                        <div className="truncate">
                          <div className="font-medium truncate">
                            {selectedMaterial.name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {selectedMaterial.partNumber}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        Tap to search materials...
                      </span>
                    )}
                    <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </Button>
                </div>

                {selectedMaterial && (
                  <div className="flex gap-2">
                    <Badge variant="outline">{selectedMaterial.categoryName}</Badge>
                    <Badge variant="secondary">{selectedMaterial.uom}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              className="w-full h-12"
              disabled={!selectedMaterial}
              onClick={() => {
                vibrateTap();
                setStep(2);
              }}
            >
              Next
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </>
        )}

        {/* Step 2: Enter Lots */}
        {step === 2 && selectedMaterial && (
          <>
            {/* Selected Material Summary */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Package className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  <div className="truncate">
                    <div className="font-medium truncate">{selectedMaterial.name}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {selectedMaterial.partNumber}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    vibrateTap();
                    setStep(1);
                  }}
                >
                  Change
                </Button>
              </CardContent>
            </Card>

            {/* Lot Entries */}
            <div className="space-y-3">
              {lots.map((lot, index) => (
                <Card key={lot.id}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Lot {index + 1}</span>
                      {lots.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLot(lot.id)}
                          className="min-h-[44px] min-w-[44px] text-destructive"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={lot.quantity || ""}
                          onChange={(e) =>
                            updateLot(lot.id, {
                              quantity: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder={selectedMaterial.uom}
                          className="h-12 text-base"
                        />
                      </div>
                      <div>
                        <Label>Unit Type</Label>
                        <Select
                          value={lot.unitType}
                          onValueChange={(value) =>
                            updateLot(lot.id, {
                              unitType: value as LotEntry["unitType"],
                            })
                          }
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Units per {lot.unitType}</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={lot.unitsPerPackage || ""}
                          onChange={(e) =>
                            updateLot(lot.id, {
                              unitsPerPackage: parseInt(e.target.value) || undefined,
                            })
                          }
                          placeholder="e.g., 500"
                          className="h-12 text-base"
                        />
                      </div>
                      <div>
                        <Label>Supplier Lot #</Label>
                        <Input
                          value={lot.supplierLotNumber || ""}
                          onChange={(e) =>
                            updateLot(lot.id, { supplierLotNumber: e.target.value })
                          }
                          placeholder="Optional"
                          className="h-12 text-base"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Expiry Date</Label>
                        <Input
                          type="date"
                          value={lot.expiryDate || ""}
                          onChange={(e) =>
                            updateLot(lot.id, { expiryDate: e.target.value })
                          }
                          className="h-12 text-base"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="outline"
                className="w-full h-12"
                onClick={addLot}
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Another Lot
              </Button>
            </div>

            {/* Summary */}
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Total Lots:</span>
                  <span className="font-medium">{lots.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Quantity:</span>
                  <span className="font-medium">
                    {totalQuantity} {selectedMaterial.uom}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => {
                  vibrateTap();
                  setStep(1);
                }}
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
              <Button
                className="flex-1 h-12"
                disabled={!hasValidLots || submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Receiving..." : "Receive Lots"}
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Materials Received</h3>
                <p className="text-muted-foreground">
                  {createdLots.length} lot{createdLots.length !== 1 ? "s" : ""}{" "}
                  created successfully
                </p>
              </CardContent>
            </Card>

            {/* Created Lots */}
            <div className="space-y-2">
              {createdLots.map((lot) => (
                <Card key={lot.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-medium">{lot.lotNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {lot.quantity} {lot.uom} ({lot.unitType})
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-10">
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={resetForm}
              >
                Receive More
              </Button>
              <Link href="/worker/materials" className="flex-1">
                <Button className="w-full h-12">Done</Button>
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Material Search Sheet */}
      <MaterialSearchSheet
        open={materialSheetOpen}
        onOpenChange={setMaterialSheetOpen}
        onSelect={setSelectedMaterial}
        selectedId={selectedMaterial?.id}
      />
    </div>
  );
}
