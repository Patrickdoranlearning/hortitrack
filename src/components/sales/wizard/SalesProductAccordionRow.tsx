'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { UseFormReturn, useWatch } from 'react-hook-form';
import { FormControl, FormField } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Trash2, Minus, Plus, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BatchAllocation } from '../BatchSelectionDialog';
import type { ProductWithBatches } from '@/server/sales/products-with-batches';
import type { CreateOrderInput } from '@/lib/sales/types';
import { cn } from '@/lib/utils';

export type PricingHint = {
  rrp?: number | null;
  multibuyQty2?: number | null;
  multibuyPrice2?: number | null;
};

// Quick quantity presets - TODO: Fetch from product size (plant_sizes.shelf_quantity, trolley_quantity)
// For now using sensible defaults that can be overridden via props
export const DEFAULT_quickQty = {
  halfShelf: 15,
  fullShelf: 30,
  fullTrolley: 180,
} as const;

export type QuickQtyConfig = typeof DEFAULT_quickQty;

type Props = {
  index: number;
  form: UseFormReturn<CreateOrderInput>;
  products: ProductWithBatches[];
  filteredProducts: ProductWithBatches[];
  allocations: BatchAllocation[];
  onAllocationsChange: (index: number, allocations: BatchAllocation[]) => void;
  onRemove: () => void;
  selectedCustomerId?: string;
  defaultExpanded?: boolean;
  pricingHints?: Record<string, PricingHint>;
  quickQty?: QuickQtyConfig;
};

// Track variety-level allocations
type VarietyAllocation = {
  varietyName: string;
  family: string | null;
  qty: number;
  // Optional specific batch allocations within the variety
  batchAllocations?: Map<string, { batchId: string; batchNumber: string; qty: number; location?: string }>;
};

export function SalesProductAccordionRow({
  index,
  form,
  products,
  filteredProducts,
  allocations,
  onAllocationsChange,
  onRemove,
  selectedCustomerId,
  pricingHints = {},
  quickQty = DEFAULT_quickQty,
}: Props) {
  const line = useWatch({ control: form.control, name: `lines.${index}` });
  const [isExpanded, setIsExpanded] = useState(false);
  const [varietyAllocations, setVarietyAllocations] = useState<Map<string, VarietyAllocation>>(new Map());
  const [expandedVarieties, setExpandedVarieties] = useState<Set<string>>(new Set());

  // Use ref to avoid infinite loops with onAllocationsChange
  const onAllocationsChangeRef = useRef(onAllocationsChange);
  onAllocationsChangeRef.current = onAllocationsChange;

  // Track previous allocations to avoid unnecessary updates
  const prevAllocationsRef = useRef<string>('');

  const selectedProduct = useMemo(() => {
    if (!line?.productId) return undefined;
    return products.find((p) => p.id === line.productId);
  }, [line?.productId, products]);

  // Get varieties with their batches (excluding Grower's Choice)
  const varietiesWithBatches = useMemo(() => {
    if (!selectedProduct) return [];

    const varietyMap = new Map<string, {
      name: string;
      family: string | null;
      batches: typeof selectedProduct.batches;
      totalStock: number;
    }>();

    // Group batches by variety
    for (const batch of selectedProduct.batches) {
      const varietyName = batch.plantVariety || '';
      if (varietyName) {
        if (!varietyMap.has(varietyName)) {
          varietyMap.set(varietyName, {
            name: varietyName,
            family: batch.family || selectedProduct.family || null,
            batches: [],
            totalStock: 0,
          });
        }
        const variety = varietyMap.get(varietyName)!;
        variety.batches.push(batch);
        variety.totalStock += batch.quantity;
      }
    }

    // Sort varieties alphabetically
    return Array.from(varietyMap.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [selectedProduct]);

  // Check if product has varieties to show (at least 1 variety with a name)
  // or multiple batches that could be selected from
  const hasVarietiesToShow = varietiesWithBatches.length >= 1;
  const hasMultipleBatches = selectedProduct ? selectedProduct.batches.length > 1 : false;

  // Calculate total quantity from variety selections
  const totalFromVarieties = useMemo(() => {
    return Array.from(varietyAllocations.values()).reduce((sum, v) => sum + v.qty, 0);
  }, [varietyAllocations]);

  // Use variety total if we have selections, otherwise use form qty
  const displayQty = totalFromVarieties > 0 ? totalFromVarieties : (line?.qty || 0);
  const price = typeof line?.unitPrice === 'number' ? line.unitPrice : Number(line?.unitPrice) || 0;
  const vatRate = typeof line?.vatRate === 'number' ? line.vatRate : Number(line?.vatRate) || 0;
  const lineNet = displayQty * price;
  const lineVat = lineNet * (vatRate / 100);
  const lineTotal = lineNet + lineVat;

  // Sync variety total to form
  useEffect(() => {
    if (totalFromVarieties > 0) {
      form.setValue(`lines.${index}.qty`, totalFromVarieties);
    }
  }, [totalFromVarieties, form, index]);

  // Sync allocations when variety allocations change
  useEffect(() => {
    const newAllocations: BatchAllocation[] = [];

    varietyAllocations.forEach((va) => {
      if (va.qty > 0) {
        // If user specified specific batches, use those
        if (va.batchAllocations && va.batchAllocations.size > 0) {
          va.batchAllocations.forEach((ba) => {
            if (ba.qty > 0) {
              newAllocations.push({
                batchId: ba.batchId,
                batchNumber: ba.batchNumber,
                plantVariety: va.varietyName,
                family: va.family,
                size: selectedProduct?.size || '',
                qty: ba.qty,
                location: ba.location,
              });
            }
          });
        } else {
          // Otherwise create a variety-level allocation (picker will decide batch)
          newAllocations.push({
            batchId: '', // Empty = picker decides
            batchNumber: '',
            plantVariety: va.varietyName,
            family: va.family,
            size: selectedProduct?.size || '',
            qty: va.qty,
          });
        }
      }
    });

    // Only call if allocations have actually changed
    const allocationsKey = JSON.stringify(
      newAllocations.map(a => `${a.plantVariety}:${a.batchId}:${a.qty}`).sort()
    );
    if (allocationsKey !== prevAllocationsRef.current) {
      prevAllocationsRef.current = allocationsKey;
      onAllocationsChangeRef.current(index, newAllocations);
    }
  }, [varietyAllocations, index, selectedProduct?.size]);

  const resolveProductLabel = (product: ProductWithBatches) => {
    const alias = product.aliases?.find(
      (a) => a.isActive !== false && (selectedCustomerId ? a.customerId === selectedCustomerId : !!a.aliasName)
    );
    if (alias?.aliasName) return alias.aliasName;
    if (product.name) return product.name;
    return `${product.plantVariety} - ${product.size}`;
  };

  const getProductPrice = (product: ProductWithBatches): number | undefined => {
    if (selectedCustomerId) {
      const customerAlias = product.aliases?.find(
        (a) => a.isActive !== false && a.customerId === selectedCustomerId && a.unitPriceExVat != null
      );
      if (customerAlias?.unitPriceExVat != null) {
        return customerAlias.unitPriceExVat;
      }
    }
    return product.defaultPrice ?? undefined;
  };

  const handleSelectProduct = (productId: string) => {
    form.setValue(`lines.${index}.productId`, productId);
    const product = products.find((p) => p.id === productId);
    if (product) {
      form.setValue(`lines.${index}.plantVariety`, '');
      form.setValue(`lines.${index}.size`, product.size);
      const productPrice = getProductPrice(product);
      if (productPrice !== undefined) {
        form.setValue(`lines.${index}.unitPrice`, productPrice);
      }
      const hint = pricingHints[productId];
      if (hint) {
        if (hint.rrp != null) form.setValue(`lines.${index}.rrp`, hint.rrp);
        if (hint.multibuyQty2 != null) form.setValue(`lines.${index}.multibuyQty2`, hint.multibuyQty2);
        if (hint.multibuyPrice2 != null) form.setValue(`lines.${index}.multibuyPrice2`, hint.multibuyPrice2);
      }
    }
    setVarietyAllocations(new Map());
    setExpandedVarieties(new Set());
    setIsExpanded(false);
    prevAllocationsRef.current = '[]';
    onAllocationsChangeRef.current(index, []);
  };

  const handleMainQtyChange = (newQty: number) => {
    form.setValue(`lines.${index}.qty`, Math.max(0, newQty));
    // Clear variety selections when manually editing qty (using Grower's Choice)
    if (totalFromVarieties > 0) {
      setVarietyAllocations(new Map());
    }
    prevAllocationsRef.current = '[]';
    onAllocationsChangeRef.current(index, []);
  };

  const updateVarietyQty = (varietyKey: string, variety: { name: string; family: string | null }, delta: number) => {
    setVarietyAllocations(prev => {
      const next = new Map(prev);
      const existing = next.get(varietyKey);
      const currentQty = existing?.qty || 0;
      const newQty = Math.max(0, currentQty + delta);

      if (newQty === 0) {
        next.delete(varietyKey);
      } else {
        next.set(varietyKey, {
          varietyName: variety.name,
          family: variety.family,
          qty: newQty,
          batchAllocations: existing?.batchAllocations,
        });
      }
      return next;
    });
  };

  const setVarietyQtyDirect = (varietyKey: string, variety: { name: string; family: string | null }, qty: number) => {
    setVarietyAllocations(prev => {
      const next = new Map(prev);
      const existing = next.get(varietyKey);
      const newQty = Math.max(0, qty);

      if (newQty === 0) {
        next.delete(varietyKey);
      } else {
        next.set(varietyKey, {
          varietyName: variety.name,
          family: variety.family,
          qty: newQty,
          batchAllocations: existing?.batchAllocations,
        });
      }
      return next;
    });
  };

  const toggleVarietyExpanded = (varietyKey: string) => {
    setExpandedVarieties(prev => {
      const next = new Set(prev);
      if (next.has(varietyKey)) {
        next.delete(varietyKey);
      } else {
        next.add(varietyKey);
      }
      return next;
    });
  };

  const updateBatchQty = (
    varietyKey: string,
    variety: { name: string; family: string | null },
    batch: { id: string; batchNumber: string; quantity: number; location?: string },
    delta: number
  ) => {
    setVarietyAllocations(prev => {
      const next = new Map(prev);
      const existing = next.get(varietyKey) || {
        varietyName: variety.name,
        family: variety.family,
        qty: 0,
        batchAllocations: new Map(),
      };

      const batchAllocations = new Map(existing.batchAllocations || []);
      const currentBatch = batchAllocations.get(batch.id);
      const currentQty = currentBatch?.qty || 0;
      const newQty = Math.max(0, Math.min(batch.quantity, currentQty + delta));

      if (newQty === 0) {
        batchAllocations.delete(batch.id);
      } else {
        batchAllocations.set(batch.id, {
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          qty: newQty,
          location: batch.location,
        });
      }

      // Calculate total from batches
      const batchTotal = Array.from(batchAllocations.values()).reduce((sum, b) => sum + b.qty, 0);

      if (batchTotal === 0 && existing.qty === 0) {
        next.delete(varietyKey);
      } else {
        next.set(varietyKey, {
          ...existing,
          qty: Math.max(existing.qty, batchTotal), // Variety qty is at least sum of specific batches
          batchAllocations,
        });
      }
      return next;
    });
  };

  const setBatchQtyDirect = (
    varietyKey: string,
    variety: { name: string; family: string | null },
    batch: { id: string; batchNumber: string; quantity: number; location?: string },
    qty: number
  ) => {
    setVarietyAllocations(prev => {
      const next = new Map(prev);
      const existing = next.get(varietyKey) || {
        varietyName: variety.name,
        family: variety.family,
        qty: 0,
        batchAllocations: new Map(),
      };

      const batchAllocations = new Map(existing.batchAllocations || []);
      const newQty = Math.max(0, Math.min(batch.quantity, qty));

      if (newQty === 0) {
        batchAllocations.delete(batch.id);
      } else {
        batchAllocations.set(batch.id, {
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          qty: newQty,
          location: batch.location,
        });
      }

      // Calculate total from batches
      const batchTotal = Array.from(batchAllocations.values()).reduce((sum, b) => sum + b.qty, 0);

      if (batchTotal === 0 && existing.qty === 0) {
        next.delete(varietyKey);
      } else {
        next.set(varietyKey, {
          ...existing,
          qty: Math.max(existing.qty, batchTotal),
          batchAllocations,
        });
      }
      return next;
    });
  };

  // Count varieties with allocations
  const selectedVarietyCount = varietyAllocations.size;

  return (
    <div className="border-b last:border-b-0">
      {/* Main Product Row */}
      <div className="grid grid-cols-12 gap-1 md:gap-2 items-center py-2 px-2 md:px-3 hover:bg-muted/30">
        {/* Product Select */}
        <div className="col-span-5 md:col-span-4">
          <FormField
            control={form.control}
            name={`lines.${index}.productId`}
            render={({ field }) => (
              <Select value={field.value || ''} onValueChange={handleSelectProduct}>
                <FormControl>
                  <SelectTrigger className="h-9 text-xs md:text-sm">
                    <SelectValue placeholder="Select product..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {filteredProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {resolveProductLabel(product)}
                      <span className="text-muted-foreground ml-2">({product.availableStock})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Quantity */}
        <div className="col-span-2 md:col-span-1">
          <FormField
            control={form.control}
            name={`lines.${index}.qty`}
            render={() => (
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  className={cn(
                    "h-9 text-xs md:text-sm text-center px-1",
                    totalFromVarieties > 0 && "bg-muted text-muted-foreground"
                  )}
                  value={displayQty || ''}
                  onChange={(e) => handleMainQtyChange(parseInt(e.target.value) || 0)}
                  readOnly={totalFromVarieties > 0}
                  placeholder="0"
                />
              </FormControl>
            )}
          />
        </div>

        {/* Price */}
        <div className="hidden md:block md:col-span-1">
          <FormField
            control={form.control}
            name={`lines.${index}.unitPrice`}
            render={({ field }) => (
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  className="h-9 text-sm text-right"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                  placeholder="0.00"
                />
              </FormControl>
            )}
          />
        </div>

        {/* VAT % */}
        <div className="hidden md:block md:col-span-1">
          <FormField
            control={form.control}
            name={`lines.${index}.vatRate`}
            render={({ field }) => (
              <FormControl>
                <Input
                  type="number"
                  step="0.5"
                  className="h-9 text-sm text-right"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                  placeholder="13.5"
                />
              </FormControl>
            )}
          />
        </div>

        {/* Total */}
        <div className="hidden md:block md:col-span-1 text-right text-sm font-medium">
          €{lineTotal.toFixed(2)}
        </div>

        {/* Quick Qty, Expand/Collapse & Delete */}
        <div className="col-span-5 md:col-span-4 flex items-center justify-end gap-1">
          {/* Quick Qty Buttons - Only show when no varieties selected (Grower's Choice mode) */}
          {selectedProduct && totalFromVarieties === 0 && (
            <div className="hidden md:flex items-center gap-1 mr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handleMainQtyChange(quickQty.halfShelf)}
                title={`Half shelf (${quickQty.halfShelf})`}
              >
                ½S
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handleMainQtyChange(quickQty.fullShelf)}
                title={`Full shelf (${quickQty.fullShelf})`}
              >
                1S
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handleMainQtyChange(quickQty.fullTrolley)}
                title={`Full trolley (${quickQty.fullTrolley})`}
              >
                1T
              </Button>
            </div>
          )}
          {selectedProduct && (hasVarietiesToShow || hasMultipleBatches) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-2 text-xs gap-1",
                selectedVarietyCount > 0 && "text-primary font-medium"
              )}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span>
                {selectedVarietyCount > 0
                  ? `${selectedVarietyCount} variet${selectedVarietyCount > 1 ? 'ies' : 'y'}`
                  : hasVarietiesToShow
                    ? `${varietiesWithBatches.length} variet${varietiesWithBatches.length > 1 ? 'ies' : 'y'}`
                    : `${selectedProduct.batches.length} batches`
                }
              </span>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Expanded Varieties/Batches Panel - Full Width */}
      {isExpanded && selectedProduct && (hasVarietiesToShow || hasMultipleBatches) && (
        <div className="bg-muted/20 border-t">
          {hasVarietiesToShow ? varietiesWithBatches.map(([varietyKey, variety]) => {
            const allocation = varietyAllocations.get(varietyKey);
            const varietyQty = allocation?.qty || 0;
            const isVarietyExpanded = expandedVarieties.has(varietyKey);

            return (
              <div key={varietyKey} className="border-b last:border-b-0 border-muted/50">
                {/* Variety Row */}
                <div className="grid grid-cols-12 gap-2 items-center py-2 px-3">
                  {/* Variety Name */}
                  <div className="col-span-5 md:col-span-4">
                    <div className="text-sm font-medium truncate">{variety.name}</div>
                    {variety.family && (
                      <div className="text-[10px] text-muted-foreground truncate">{variety.family}</div>
                    )}
                  </div>

                  {/* Variety Quantity Controls */}
                  <div className="col-span-4 md:col-span-3 flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateVarietyQty(varietyKey, variety, -10)}
                      disabled={varietyQty === 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min="0"
                      className="h-7 w-16 text-xs text-center px-1"
                      value={varietyQty || ''}
                      onChange={(e) => setVarietyQtyDirect(varietyKey, variety, parseInt(e.target.value) || 0)}
                      placeholder="0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateVarietyQty(varietyKey, variety, 10)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Quick Qty Buttons & Batches & Available Stock */}
                  <div className="col-span-3 md:col-span-5 flex items-center justify-end">
                    <div className="hidden md:flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-8 px-0 text-[10px]"
                        onClick={() => setVarietyQtyDirect(varietyKey, variety, quickQty.halfShelf)}
                        title={`Half shelf (${quickQty.halfShelf})`}
                      >
                        ½S
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-8 px-0 text-[10px]"
                        onClick={() => setVarietyQtyDirect(varietyKey, variety, quickQty.fullShelf)}
                        title={`Full shelf (${quickQty.fullShelf})`}
                      >
                        1S
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-8 px-0 text-[10px]"
                        onClick={() => setVarietyQtyDirect(varietyKey, variety, quickQty.fullTrolley)}
                        title={`Full trolley (${quickQty.fullTrolley})`}
                      >
                        1T
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {variety.totalStock} avail
                    </span>
                    {variety.batches.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-6 px-2 text-[10px] gap-1",
                          (allocation?.batchAllocations?.size ?? 0) > 0 && "text-primary font-medium"
                        )}
                        onClick={() => toggleVarietyExpanded(varietyKey)}
                      >
                        {isVarietyExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <span>
                          {(allocation?.batchAllocations?.size ?? 0) > 0
                            ? `${allocation?.batchAllocations?.size} batch${(allocation?.batchAllocations?.size ?? 0) > 1 ? 'es' : ''}`
                            : `${variety.batches.length} batches`
                          }
                        </span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Batch Details Panel - Full Width Dropdown */}
                {isVarietyExpanded && variety.batches.length > 1 && (
                  <div className="bg-muted/30 border-t border-muted/50">
                    {variety.batches.map((batch) => {
                      const batchAlloc = allocation?.batchAllocations?.get(batch.id);
                      const batchQty = batchAlloc?.qty || 0;

                      return (
                        <div
                          key={batch.id}
                          className={cn(
                            "grid grid-cols-12 gap-2 items-center py-1.5 px-3 pl-6 border-b last:border-b-0 border-muted/30",
                            batchQty > 0 && "bg-primary/5"
                          )}
                        >
                          {/* Batch Info */}
                          <div className="col-span-5 md:col-span-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium truncate">{batch.batchNumber}</span>
                              {batch.grade && (
                                <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                  {batch.grade}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                              {batch.location ? (
                                <>
                                  <MapPin className="h-2.5 w-2.5" />
                                  {batch.location}
                                </>
                              ) : (
                                <span className="italic">No location</span>
                              )}
                            </div>
                          </div>

                          {/* Batch Quantity Controls */}
                          <div className="col-span-4 md:col-span-3 flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateBatchQty(varietyKey, variety, batch, -10)}
                              disabled={batchQty === 0}
                            >
                              <Minus className="h-2.5 w-2.5" />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              max={batch.quantity}
                              className="h-6 w-14 text-xs text-center px-1"
                              value={batchQty || ''}
                              onChange={(e) => {
                                const qty = Math.min(batch.quantity, parseInt(e.target.value) || 0);
                                updateBatchQty(varietyKey, variety, batch, qty - batchQty);
                              }}
                              placeholder="0"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateBatchQty(varietyKey, variety, batch, 10)}
                              disabled={batchQty >= batch.quantity}
                            >
                              <Plus className="h-2.5 w-2.5" />
                            </Button>
                          </div>

                          {/* Quick Qty Buttons & Batch Available */}
                          <div className="col-span-3 md:col-span-5 flex items-center justify-end">
                            <div className="hidden md:flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-5 w-7 px-0 text-[9px]"
                                onClick={() => setBatchQtyDirect(varietyKey, variety, batch, quickQty.halfShelf)}
                                title={`Half shelf (${quickQty.halfShelf})`}
                              >
                                ½S
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-5 w-7 px-0 text-[9px]"
                                onClick={() => setBatchQtyDirect(varietyKey, variety, batch, quickQty.fullShelf)}
                                title={`Full shelf (${quickQty.fullShelf})`}
                              >
                                1S
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-5 w-7 px-0 text-[9px]"
                                onClick={() => setBatchQtyDirect(varietyKey, variety, batch, quickQty.fullTrolley)}
                                title={`Full trolley (${quickQty.fullTrolley})`}
                              >
                                1T
                              </Button>
                            </div>
                            <span className="text-xs text-muted-foreground w-20 text-right">
                              {batch.quantity} avail
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }) : (
            /* Fallback: Show batches directly when no named varieties */
            selectedProduct.batches.map((batch) => {
              const batchAlloc = varietyAllocations.get('')?.batchAllocations?.get(batch.id);
              const batchQty = batchAlloc?.qty || 0;

              return (
                <div
                  key={batch.id}
                  className={cn(
                    "grid grid-cols-12 gap-2 items-center py-2 px-3 border-b last:border-b-0 border-muted/50",
                    batchQty > 0 && "bg-primary/5"
                  )}
                >
                  {/* Batch Info */}
                  <div className="col-span-5 md:col-span-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{batch.batchNumber}</span>
                      {batch.grade && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">
                          {batch.grade}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                      {batch.location ? (
                        <>
                          <MapPin className="h-2.5 w-2.5" />
                          {batch.location}
                        </>
                      ) : (
                        <span className="italic">No location</span>
                      )}
                    </div>
                  </div>

                  {/* Batch Quantity Controls */}
                  <div className="col-span-4 md:col-span-3 flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateBatchQty('', { name: '', family: null }, batch, -10)}
                      disabled={batchQty === 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min="0"
                      max={batch.quantity}
                      className="h-7 w-16 text-xs text-center px-1"
                      value={batchQty || ''}
                      onChange={(e) => {
                        const qty = Math.min(batch.quantity, parseInt(e.target.value) || 0);
                        updateBatchQty('', { name: '', family: null }, batch, qty - batchQty);
                      }}
                      placeholder="0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateBatchQty('', { name: '', family: null }, batch, 10)}
                      disabled={batchQty >= batch.quantity}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Quick Qty Buttons & Batch Available */}
                  <div className="col-span-3 md:col-span-5 flex items-center justify-end">
                    <div className="hidden md:flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-8 px-0 text-[10px]"
                        onClick={() => setBatchQtyDirect('', { name: '', family: null }, batch, quickQty.halfShelf)}
                        title={`Half shelf (${quickQty.halfShelf})`}
                      >
                        ½S
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-8 px-0 text-[10px]"
                        onClick={() => setBatchQtyDirect('', { name: '', family: null }, batch, quickQty.fullShelf)}
                        title={`Full shelf (${quickQty.fullShelf})`}
                      >
                        1S
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-8 px-0 text-[10px]"
                        onClick={() => setBatchQtyDirect('', { name: '', family: null }, batch, quickQty.fullTrolley)}
                        title={`Full trolley (${quickQty.fullTrolley})`}
                      >
                        1T
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {batch.quantity} avail
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {/* Summary Footer */}
          {totalFromVarieties > 0 && (
            <div className="px-3 py-2 bg-background border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total selected:</span>
              <span className="text-sm font-semibold">{totalFromVarieties}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
