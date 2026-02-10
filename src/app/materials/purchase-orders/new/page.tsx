'use client';

import { useState, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ShoppingCart,
  Search,
  Package,
} from 'lucide-react';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/toast';
import { fetchJson } from '@/lib/http/fetchJson';
import { ReferenceDataContext } from '@/contexts/ReferenceDataContext';
import type { Material } from '@/lib/types/materials';

type OrderLine = {
  materialId: string;
  material: Material;
  quantityOrdered: number;
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
};

type MaterialsResponse = {
  materials: Material[];
  total: number;
};

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { data: refData } = useContext(ReferenceDataContext);

  const suppliers = refData?.suppliers ?? [];

  const [supplierId, setSupplierId] = useState<string>('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [supplierRef, setSupplierRef] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Material picker state
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');

  // Fetch materials for picker
  const { data: materialsData } = useSWR<MaterialsResponse>(
    showMaterialPicker ? `/api/materials?isActive=true&search=${encodeURIComponent(materialSearch)}` : null,
    (url) => fetchJson(url)
  );

  const availableMaterials = useMemo(() => {
    const selectedIds = new Set(lines.map((l) => l.materialId));
    return (materialsData?.materials ?? []).filter((m) => !selectedIds.has(m.id));
  }, [materialsData?.materials, lines]);

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    return { subtotal, taxAmount: 0, totalAmount: subtotal };
  }, [lines]);

  const addMaterial = (material: Material) => {
    const unitPrice = material.standardCost ?? 0;
    setLines([
      ...lines,
      {
        materialId: material.id,
        material,
        quantityOrdered: 1,
        unitPrice,
        discountPct: 0,
        lineTotal: unitPrice,
      },
    ]);
    setShowMaterialPicker(false);
    setMaterialSearch('');
  };

  const updateLine = (index: number, updates: Partial<OrderLine>) => {
    setLines(
      lines.map((line, i) => {
        if (i !== index) return line;
        const updated = { ...line, ...updates };
        // Recalculate line total
        const discount = (updated.unitPrice * updated.quantityOrdered * updated.discountPct) / 100;
        updated.lineTotal = updated.unitPrice * updated.quantityOrdered - discount;
        return updated;
      })
    );
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }
    if (lines.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create the PO
      const response = await fetchJson('/api/materials/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          expectedDeliveryDate: expectedDeliveryDate || null,
          supplierRef: supplierRef || undefined,
          notes: notes || undefined,
          lines: lines.map((l) => ({
            materialId: l.materialId,
            quantityOrdered: l.quantityOrdered,
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
          })),
        }),
      });

      const order = response.order;

      // Submit if not saving as draft
      if (!asDraft) {
        await fetchJson(`/api/materials/purchase-orders/${order.id}/submit`, {
          method: 'POST',
        });
      }

      toast.success(`${asDraft ? 'Purchase order saved as draft' : 'Purchase order submitted'}: ${order.poNumber}`);

      router.push('/materials/purchase-orders');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  return (
    <PageFrame moduleKey="materials">
      <div className="space-y-6">
        <ModulePageHeader
          title="New Purchase Order"
          description="Create a new order for materials from a supplier."
          actionsSlot={
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier *</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger id="supplier">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expected-date">Expected Delivery</Label>
                    <Input
                      id="expected-date"
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier-ref">Supplier Reference</Label>
                  <Input
                    id="supplier-ref"
                    value={supplierRef}
                    onChange={(e) => setSupplierRef(e.target.value)}
                    placeholder="e.g., Quote #123"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes for this order"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Line Items</CardTitle>
                  <CardDescription>Add materials to your order</CardDescription>
                </div>
                <Button onClick={() => setShowMaterialPicker(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Material
                </Button>
              </CardHeader>
              <CardContent>
                {lines.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No items added yet</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowMaterialPicker(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Material
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead className="w-[100px]">Qty</TableHead>
                          <TableHead className="w-[120px] hidden md:table-cell">Unit Price</TableHead>
                          <TableHead className="w-[100px] hidden md:table-cell">Discount %</TableHead>
                          <TableHead className="text-right w-[120px]">Line Total</TableHead>
                          <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line, index) => (
                          <TableRow key={line.materialId}>
                            <TableCell>
                              <div>
                                <span className="font-medium">{line.material.name}</span>
                                <span className="text-muted-foreground text-sm ml-2">
                                  ({line.material.partNumber})
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                value={line.quantityOrdered}
                                onChange={(e) =>
                                  updateLine(index, {
                                    quantityOrdered: parseInt(e.target.value) || 1,
                                  })
                                }
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={line.unitPrice}
                                onChange={(e) =>
                                  updateLine(index, {
                                    unitPrice: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={line.discountPct}
                                onChange={(e) =>
                                  updateLine(index, {
                                    discountPct: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(line.lineTotal)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLine(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items</span>
                  <span>{lines.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Qty</span>
                  <span>{lines.reduce((sum, l) => sum + l.quantityOrdered, 0)}</span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-lg mt-2">
                    <span>Total</span>
                    <span>{formatCurrency(totals.totalAmount)}</span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => handleSubmit(false)}
                    disabled={isSubmitting || lines.length === 0}
                  >
                    {isSubmitting ? 'Creating...' : 'Create & Submit'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleSubmit(true)}
                    disabled={isSubmitting || lines.length === 0}
                  >
                    Save as Draft
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Material Picker Dialog */}
      <Dialog open={showMaterialPicker} onOpenChange={setShowMaterialPicker}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Material</DialogTitle>
            <DialogDescription>Search and select materials to add to your order</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search materials..."
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {availableMaterials.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No materials found</p>
                </div>
              ) : (
                availableMaterials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => addMaterial(material)}
                  >
                    <div>
                      <div className="font-medium">{material.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {material.partNumber}
                        {material.category && (
                          <Badge variant="outline" className="ml-2">
                            {material.category.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {material.standardCost ? (
                        <span className="font-medium">
                          {formatCurrency(material.standardCost)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No price</span>
                      )}
                      <div className="text-xs text-muted-foreground">per {material.baseUom}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMaterialPicker(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
