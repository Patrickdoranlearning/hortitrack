'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  ScanLine,
} from 'lucide-react';
import { PageFrame, ModulePageHeader } from '@/ui/templates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MaterialSearchCombobox } from '@/components/materials/MaterialSearchCombobox';
import type { Material } from '@/lib/types/materials';
import type { MaterialLot, MaterialLotUnitType } from '@/lib/types/material-lots';

type LotEntry = {
  id: string;
  quantity: number;
  unitType: MaterialLotUnitType;
  unitsPerPackage?: number;
  supplierLotNumber?: string;
  expiryDate?: string;
  notes?: string;
};

const UNIT_TYPES: { value: MaterialLotUnitType; label: string }[] = [
  { value: 'box', label: 'Box' },
  { value: 'bag', label: 'Bag' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'roll', label: 'Roll' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'unit', label: 'Unit' },
];

export default function ReceiveMaterialsPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [lots, setLots] = useState<LotEntry[]>([
    { id: '1', quantity: 0, unitType: 'box' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [createdLots, setCreatedLots] = useState<MaterialLot[]>([]);

  const addLot = () => {
    setLots((prev) => [
      ...prev,
      { id: String(Date.now()), quantity: 0, unitType: 'box' },
    ]);
  };

  const removeLot = (id: string) => {
    setLots((prev) => prev.filter((lot) => lot.id !== id));
  };

  const updateLot = (id: string, updates: Partial<LotEntry>) => {
    setLots((prev) =>
      prev.map((lot) => (lot.id === id ? { ...lot, ...updates } : lot))
    );
  };

  const handleSubmit = async () => {
    if (!selectedMaterial || lots.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/materials/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: selectedMaterial.id,
          lots: lots.map((lot) => ({
            quantity: lot.quantity,
            unitType: lot.unitType,
            unitsPerPackage: lot.unitsPerPackage,
            supplierLotNumber: lot.supplierLotNumber,
            expiryDate: lot.expiryDate,
            notes: lot.notes,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to receive lots');

      const data = await res.json();
      setCreatedLots(data.lots);
      setStep(3);
    } catch (error) {
      console.error('Error receiving lots:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const totalQuantity = lots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);

  return (
    <PageFrame moduleKey="materials">
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/materials">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        <ModulePageHeader
          title="Receive Materials"
          description="Check in new material lots and generate scannable labels."
        />

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-0.5 mx-2 ${
                    step > s ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-12 text-sm text-muted-foreground">
          <span className={step >= 1 ? 'text-foreground font-medium' : ''}>
            Select Material
          </span>
          <span className={step >= 2 ? 'text-foreground font-medium' : ''}>
            Enter Lots
          </span>
          <span className={step >= 3 ? 'text-foreground font-medium' : ''}>
            Done
          </span>
        </div>

        {/* Step 1: Select Material */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Material</CardTitle>
              <CardDescription>
                Search for the material you are receiving or scan its barcode.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Material</Label>
                <MaterialSearchCombobox
                  value={selectedMaterial?.id}
                  onSelect={(material) => setSelectedMaterial(material)}
                  placeholder="Search or scan material barcode..."
                />
              </div>

              {selectedMaterial && (
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{selectedMaterial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedMaterial.partNumber} | {selectedMaterial.category?.name}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedMaterial}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Enter Lots */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Enter Lot Details</CardTitle>
              <CardDescription>
                Add the lots you are receiving. Each lot will get a unique scannable barcode.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Material Summary */}
              <div className="p-4 rounded-lg bg-muted flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{selectedMaterial?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedMaterial?.partNumber}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                  Change
                </Button>
              </div>

              {/* Lots */}
              <div className="space-y-4">
                {lots.map((lot, index) => (
                  <div key={lot.id} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Lot {index + 1}</span>
                      {lots.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLot(lot.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          min="0"
                          value={lot.quantity || ''}
                          onChange={(e) =>
                            updateLot(lot.id, { quantity: parseFloat(e.target.value) || 0 })
                          }
                          placeholder={`Quantity in ${selectedMaterial?.baseUom || 'units'}`}
                        />
                      </div>
                      <div>
                        <Label>Unit Type</Label>
                        <Select
                          value={lot.unitType}
                          onValueChange={(value) =>
                            updateLot(lot.id, { unitType: value as MaterialLotUnitType })
                          }
                        >
                          <SelectTrigger>
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
                        <Label>Units Per {lot.unitType}</Label>
                        <Input
                          type="number"
                          min="0"
                          value={lot.unitsPerPackage || ''}
                          onChange={(e) =>
                            updateLot(lot.id, {
                              unitsPerPackage: parseFloat(e.target.value) || undefined,
                            })
                          }
                          placeholder="e.g., 500"
                        />
                      </div>
                      <div>
                        <Label>Supplier Lot #</Label>
                        <Input
                          value={lot.supplierLotNumber || ''}
                          onChange={(e) =>
                            updateLot(lot.id, { supplierLotNumber: e.target.value })
                          }
                          placeholder="Supplier's lot number"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Expiry Date</Label>
                        <Input
                          type="date"
                          value={lot.expiryDate || ''}
                          onChange={(e) =>
                            updateLot(lot.id, { expiryDate: e.target.value })
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={lot.notes || ''}
                          onChange={(e) => updateLot(lot.id, { notes: e.target.value })}
                          placeholder="Optional notes about this lot"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button variant="outline" onClick={addLot} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Lot
                </Button>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex justify-between text-sm">
                  <span>Total Lots:</span>
                  <span className="font-medium">{lots.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Quantity:</span>
                  <span className="font-medium">
                    {totalQuantity} {selectedMaterial?.baseUom}
                  </span>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || lots.every((l) => !l.quantity)}
                >
                  {submitting ? 'Receiving...' : 'Receive Lots'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Materials Received</CardTitle>
                  <CardDescription>
                    {createdLots.length} lot{createdLots.length !== 1 ? 's' : ''} created successfully.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Created Lots */}
              <div className="space-y-2">
                {createdLots.map((lot) => (
                  <div
                    key={lot.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-mono font-medium">{lot.lotNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {lot.currentQuantity} {lot.uom}
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Printer className="h-4 w-4 mr-2" />
                      Print Label
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStep(1);
                    setSelectedMaterial(null);
                    setLots([{ id: '1', quantity: 0, unitType: 'box' }]);
                    setCreatedLots([]);
                  }}
                >
                  Receive More
                </Button>
                <Button asChild className="flex-1">
                  <Link href="/materials/lots">View All Lots</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageFrame>
  );
}
