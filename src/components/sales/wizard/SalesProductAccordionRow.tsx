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
import type { ProductGroupWithAvailability } from '@/server/sales/product-groups-with-availability';
import type { CreateOrderInput } from '@/lib/sales/types';
import { cn } from '@/lib/utils';

export type PricingHint = {
  rrp?: number | null;
  multibuyQty2?: number | null;
  multibuyPrice2?: number | null;
};

// Default quick quantity presets - used as fallback when product has no quantity settings
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
  productGroups?: ProductGroupWithAvailability[];
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
  productGroups = [],
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
  const [mixedQty, setMixedQty] = useState(0); // Picker's choice quantity

  // Use ref to avoid infinite loops with onAllocationsChange
  const onAllocationsChangeRef = useRef(onAllocationsChange);
  onAllocationsChangeRef.current = onAllocationsChange;

  // Track previous allocations to avoid unnecessary updates
  const prevAllocationsRef = useRef<string>('');

  const selectedProduct = useMemo(() => {
    if (!line?.productId) return undefined;
    return products.find((p) => p.id === line.productId);
  }, [line?.productId, products]);

  // Check if a product group is selected
  const selectedProductGroup = useMemo(() => {
    if (!line?.productGroupId) return undefined;
    return productGroups.find((g) => g.id === line.productGroupId);
  }, [line?.productGroupId, productGroups]);

  // Determine the current selection value for the dropdown
  const selectValue = useMemo(() => {
    if (line?.productGroupId) return `group:${line.productGroupId}`;
    return line?.productId || '';
  }, [line?.productId, line?.productGroupId]);

  // Compute quick qty values from selected product (override prop if product has quantities)
  const quickQtyValues = useMemo(() => {
    const shelf = selectedProduct?.shelfQuantity ?? quickQty.fullShelf;
    const trolley = selectedProduct?.trolleyQuantity ?? quickQty.fullTrolley;
    return {
      halfShelf: Math.round(shelf / 2),
      fullShelf: shelf,
      fullTrolley: trolley,
    };
  }, [selectedProduct?.shelfQuantity, selectedProduct?.trolleyQuantity, quickQty]);

  // MOQ and unit qty validation
  const minOrderQty = selectedProduct?.minOrderQty ?? 1;
  const unitQty = selectedProduct?.unitQty ?? 1;

  // Calculate total quantity from variety selections (moved up to be available for qtyValidation)
  const totalFromVarieties = useMemo(() => {
    return Array.from(varietyAllocations.values()).reduce((sum, v) => sum + v.qty, 0);
  }, [varietyAllocations]);

  // Total including mixed (picker's choice) quantity
  const totalWithMixed = totalFromVarieties + mixedQty;

  // Use variety total if we have selections, otherwise use form qty
  const displayQty = totalWithMixed > 0 ? totalWithMixed : (line?.qty || 0);

  // Check quantity validation
  const qtyValidation = useMemo(() => {
    if (!selectedProduct || displayQty === 0) return null;

    const errors: string[] = [];

    if (displayQty < minOrderQty) {
      errors.push(`Min order: ${minOrderQty}`);
    }

    if (unitQty > 1 && displayQty % unitQty !== 0) {
      const nearestValid = Math.ceil(displayQty / unitQty) * unitQty;
      errors.push(`Must be multiple of ${unitQty} (nearest: ${nearestValid})`);
    }

    return errors.length > 0 ? errors : null;
  }, [displayQty, minOrderQty, unitQty, selectedProduct]);

  // Helper to snap to nearest valid quantity
  const snapToValidQty = (qty: number): number => {
    if (unitQty <= 1) return qty;
    return Math.round(qty / unitQty) * unitQty || unitQty;
  };

  // Get varieties with their batches (excluding Grower's Choice)
  // For product groups, the "varieties" are the child products
  const varietiesWithBatches = useMemo(() => {
    // If a product group is selected, show child products as "varieties"
    if (selectedProductGroup) {
      return selectedProductGroup.children.map((child) => {
        // Convert child product's batches to the expected format
        const childBatches = child.batches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          plantVariety: b.varietyName || child.productName,
          family: null as string | null,
          size: '',
          quantity: b.availableQuantity,
          grade: undefined as string | undefined,
          location: b.location ?? undefined,
          status: '',
          plantingDate: '',
        }));

        return [
          child.productId,
          {
            name: child.productName,
            family: null as string | null,
            batches: childBatches,
            totalStock: child.availableStock,
            isChildProduct: true, // Flag to indicate this is from a product group
          },
        ] as const;
      }).sort((a, b) => a[1].name.localeCompare(b[1].name));
    }

    // Regular product - group batches by variety
    if (!selectedProduct) return [];

    const varietyMap = new Map<string, {
      name: string;
      family: string | null;
      batches: typeof selectedProduct.batches;
      totalStock: number;
      isChildProduct?: boolean;
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
  }, [selectedProduct, selectedProductGroup]);

  // Check if product has varieties to show (at least 1 variety with a name)
  // or multiple batches that could be selected from
  const hasVarietiesToShow = varietiesWithBatches.length >= 1;
  const hasMultipleBatches = selectedProduct ? selectedProduct.batches.length > 1 : false;

  const price = typeof line?.unitPrice === 'number' ? line.unitPrice : Number(line?.unitPrice) || 0;
  const vatRate = typeof line?.vatRate === 'number' ? line.vatRate : Number(line?.vatRate) || 0;
  const lineNet = displayQty * price;
  const lineVat = lineNet * (vatRate / 100);
  const lineTotal = lineNet + lineVat;

  // Sync variety total (including mixed) to form
  useEffect(() => {
    if (totalWithMixed > 0) {
      form.setValue(`lines.${index}.qty`, totalWithMixed);
    }
  }, [totalWithMixed, form, index]);

  // Sync allocations when variety allocations or mixed qty change
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

    // Add mixed (picker's choice) allocation if set
    if (mixedQty > 0) {
      newAllocations.push({
        batchId: '',
        batchNumber: '',
        plantVariety: '__MIXED__', // Special flag for pickers
        family: null,
        size: selectedProduct?.size || '',
        qty: mixedQty,
      });
    }

    // Only call if allocations have actually changed
    const allocationsKey = JSON.stringify(
      newAllocations.map(a => `${a.plantVariety}:${a.batchId}:${a.qty}`).sort()
    );
    if (allocationsKey !== prevAllocationsRef.current) {
      prevAllocationsRef.current = allocationsKey;
      onAllocationsChangeRef.current(index, newAllocations);
    }
  }, [varietyAllocations, mixedQty, index, selectedProduct?.size]);

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

  const handleSelectProduct = (value: string) => {
    // Check if this is a product group selection
    if (value.startsWith('group:')) {
      const groupId = value.replace('group:', '');
      const group = productGroups.find((g) => g.id === groupId);

      // Clear product, set group
      form.setValue(`lines.${index}.productId`, undefined);
      form.setValue(`lines.${index}.productGroupId`, groupId);
      form.setValue(`lines.${index}.plantVariety`, '');

      if (group) {
        // For groups, we don't set a specific size or price yet
        form.setValue(`lines.${index}.size`, '');
        form.setValue(`lines.${index}.description`, `${group.name} (Mix)`);
      }

      setVarietyAllocations(new Map());
      setExpandedVarieties(new Set());
      setIsExpanded(true); // Auto-expand to show child products
      setMixedQty(0);
      prevAllocationsRef.current = '[]';
      onAllocationsChangeRef.current(index, []);
      return;
    }

    // Regular product selection
    form.setValue(`lines.${index}.productId`, value);
    form.setValue(`lines.${index}.productGroupId`, undefined);
    const product = products.find((p) => p.id === value);
    if (product) {
      form.setValue(`lines.${index}.plantVariety`, '');
      form.setValue(`lines.${index}.size`, product.size);
      form.setValue(`lines.${index}.description`, '');
      const productPrice = getProductPrice(product);
      if (productPrice !== undefined) {
        form.setValue(`lines.${index}.unitPrice`, productPrice);
      }
      const hint = pricingHints[value];
      if (hint) {
        if (hint.rrp != null) form.setValue(`lines.${index}.rrp`, hint.rrp);
        if (hint.multibuyQty2 != null) form.setValue(`lines.${index}.multibuyQty2`, hint.multibuyQty2);
        if (hint.multibuyPrice2 != null) form.setValue(`lines.${index}.multibuyPrice2`, hint.multibuyPrice2);
      }
    }
    setVarietyAllocations(new Map());
    setExpandedVarieties(new Set());
    setIsExpanded(false);
    setMixedQty(0);
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
      // Snap delta to unit qty increments
      const effectiveDelta = unitQty > 1 ? Math.round(delta / unitQty) * unitQty : delta;
      const newQty = Math.max(0, currentQty + effectiveDelta);

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
      // Snap to valid quantity
      const newQty = Math.max(0, unitQty > 1 ? snapToValidQty(qty) : qty);

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

  // Get total available stock (from product or group)
  const totalAvailableStock = selectedProductGroup
    ? selectedProductGroup.availableStock
    : (selectedProduct?.netAvailableStock ?? selectedProduct?.availableStock ?? 0);

  // Over-stock detection for main product row
  const isProductOverStock = (selectedProduct || selectedProductGroup) && displayQty > totalAvailableStock;

  // Remaining stock available for mixed (picker's choice)
  const remainingForMixed = totalAvailableStock - totalFromVarieties;
  const isMixedOverStock = mixedQty > remainingForMixed;

  return (
    <div className="border-b last:border-b-0">
      {/* Main Product Row */}
      <div className={cn(
        "grid grid-cols-12 gap-1 md:gap-2 items-center pt-2 px-2 md:px-3 hover:bg-muted/30",
        (qtyValidation || isProductOverStock) ? "pb-5" : "pb-2"
      )}>
        {/* Product Select */}
        <div className="col-span-5 md:col-span-4">
          <FormField
            control={form.control}
            name={`lines.${index}.productId`}
            render={() => (
              <Select value={selectValue} onValueChange={handleSelectProduct}>
                <FormControl>
                  <SelectTrigger className="h-9 text-xs md:text-sm">
                    <SelectValue placeholder="Select product..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {/* Product Groups */}
                  {productGroups.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        Product Groups (Mix)
                      </div>
                      {productGroups.map((group) => (
                        <SelectItem key={`group:${group.id}`} value={`group:${group.id}`}>
                          <span className="flex items-center gap-1">
                            <span className="text-xs text-primary font-medium">[MIX]</span>
                            {group.name}
                            <span className="text-muted-foreground ml-1">
                              ({group.availableStock} / {group.children.length} varieties)
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                      <div className="my-1 border-t" />
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        Specific Products
                      </div>
                    </>
                  )}
                  {/* Individual Products */}
                  {filteredProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {resolveProductLabel(product)}
                      <span className="text-muted-foreground ml-2">
                        ({product.netAvailableStock ?? product.availableStock})
                        {product.groupReserved > 0 && (
                          <span className="text-xs text-amber-600 ml-1">
                            [-{product.groupReserved} grp]
                          </span>
                        )}
                      </span>
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
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    className={cn(
                      "h-9 text-xs md:text-sm text-center px-1",
                      totalFromVarieties > 0 && "bg-muted text-muted-foreground",
                      qtyValidation && "border-amber-400 bg-amber-50",
                      isProductOverStock && "border-red-400 bg-red-50"
                    )}
                    value={displayQty || ''}
                    onChange={(e) => handleMainQtyChange(parseInt(e.target.value) || 0)}
                    onBlur={() => {
                      // Snap to valid quantity on blur if unitQty is set
                      if (unitQty > 1 && displayQty > 0 && displayQty % unitQty !== 0) {
                        handleMainQtyChange(snapToValidQty(displayQty));
                      }
                    }}
                    readOnly={totalFromVarieties > 0}
                    placeholder="0"
                  />
                  {isProductOverStock && (
                    <div className="absolute -bottom-4 left-0 right-0 text-[9px] text-red-600 font-medium truncate text-center">
                      {totalAvailableStock} avail ⚠
                    </div>
                  )}
                  {!isProductOverStock && qtyValidation && (
                    <div className="absolute -bottom-4 left-0 right-0 text-[9px] text-amber-600 truncate text-center">
                      {qtyValidation[0]}
                    </div>
                  )}
                </div>
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
          {/* Quick Qty Buttons - Only show for specific products when no varieties selected (Grower's Choice mode) */}
          {/* Hidden for product groups - user should expand and select specific products/mixed */}
          {selectedProduct && !selectedProductGroup && totalFromVarieties === 0 && (
            <div className="hidden md:grid grid-cols-3 gap-1 w-[126px] mr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-1 flex flex-col items-center justify-center leading-tight"
                onClick={() => handleMainQtyChange(quickQtyValues.halfShelf)}
                title={`Half shelf (${quickQtyValues.halfShelf})`}
              >
                <span className="text-[10px] text-muted-foreground">½S</span>
                <span className="text-xs font-medium">{quickQtyValues.halfShelf}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-1 flex flex-col items-center justify-center leading-tight"
                onClick={() => handleMainQtyChange(quickQtyValues.fullShelf)}
                title={`Full shelf (${quickQtyValues.fullShelf})`}
              >
                <span className="text-[10px] text-muted-foreground">1S</span>
                <span className="text-xs font-medium">{quickQtyValues.fullShelf}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-1 flex flex-col items-center justify-center leading-tight"
                onClick={() => handleMainQtyChange(quickQtyValues.fullTrolley)}
                title={`Full trolley (${quickQtyValues.fullTrolley})`}
              >
                <span className="text-[10px] text-muted-foreground">1T</span>
                <span className="text-xs font-medium">{quickQtyValues.fullTrolley}</span>
              </Button>
            </div>
          )}
          {(selectedProduct || selectedProductGroup) && (hasVarietiesToShow || hasMultipleBatches) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-2 text-xs gap-1",
                selectedVarietyCount > 0 && "text-primary font-medium",
                selectedProductGroup && "text-primary" // Highlight when group selected
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
                  ? `${selectedVarietyCount} ${selectedProductGroup ? 'product' : 'variet'}${selectedVarietyCount > 1 ? (selectedProductGroup ? 's' : 'ies') : (selectedProductGroup ? '' : 'y')}`
                  : hasVarietiesToShow
                    ? `${varietiesWithBatches.length} ${selectedProductGroup ? 'product' : 'variet'}${varietiesWithBatches.length > 1 ? (selectedProductGroup ? 's' : 'ies') : (selectedProductGroup ? '' : 'y')}`
                    : `${selectedProduct?.batches.length || 0} batches`
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
      {isExpanded && (selectedProduct || selectedProductGroup) && (hasVarietiesToShow || hasMultipleBatches) && (
        <div className="bg-muted/20 border-t">
          {hasVarietiesToShow ? varietiesWithBatches.map(([varietyKey, variety]) => {
            const allocation = varietyAllocations.get(varietyKey);
            const varietyQty = allocation?.qty || 0;
            const isVarietyExpanded = expandedVarieties.has(varietyKey);
            const isOverStock = varietyQty > variety.totalStock;

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
                      className={cn(
                        "h-7 w-16 text-xs text-center px-1",
                        isOverStock && "border-red-400 bg-red-50"
                      )}
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
                    {/* Fixed-width container for batch expander (left) */}
                    <div className="w-[90px] flex justify-end mr-1">
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
                    {/* Fixed-width avail text */}
                    <span className={cn(
                      "text-xs w-[70px] text-right mr-2",
                      isOverStock ? "text-red-600 font-medium" : "text-muted-foreground"
                    )}>
                      {variety.totalStock} avail{isOverStock && " ⚠"}
                    </span>
                    {/* Fixed-width quick buttons grid */}
                    <div className="hidden md:grid grid-cols-3 gap-1 w-[126px]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-1 flex flex-col items-center justify-center leading-tight"
                        onClick={() => setVarietyQtyDirect(varietyKey, variety, quickQtyValues.halfShelf)}
                        title={`Half shelf (${quickQtyValues.halfShelf})`}
                      >
                        <span className="text-[10px] text-muted-foreground">½S</span>
                        <span className="text-xs font-medium">{quickQtyValues.halfShelf}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-1 flex flex-col items-center justify-center leading-tight"
                        onClick={() => setVarietyQtyDirect(varietyKey, variety, quickQtyValues.fullShelf)}
                        title={`Full shelf (${quickQtyValues.fullShelf})`}
                      >
                        <span className="text-[10px] text-muted-foreground">1S</span>
                        <span className="text-xs font-medium">{quickQtyValues.fullShelf}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-1 flex flex-col items-center justify-center leading-tight"
                        onClick={() => setVarietyQtyDirect(varietyKey, variety, quickQtyValues.fullTrolley)}
                        title={`Full trolley (${quickQtyValues.fullTrolley})`}
                      >
                        <span className="text-[10px] text-muted-foreground">1T</span>
                        <span className="text-xs font-medium">{quickQtyValues.fullTrolley}</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Batch Details Panel - Full Width Dropdown */}
                {isVarietyExpanded && variety.batches.length > 1 && (
                  <div className="bg-muted/30 border-t border-muted/50">
                    {variety.batches.map((batch) => {
                      const batchAlloc = allocation?.batchAllocations?.get(batch.id);
                      const batchQty = batchAlloc?.qty || 0;
                      const isBatchOverStock = batchQty > batch.quantity;

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
                              className={cn(
                                "h-6 w-14 text-xs text-center px-1",
                                isBatchOverStock && "border-red-400 bg-red-50"
                              )}
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
                            {/* Fixed-width spacer to match variety row batch expander */}
                            <div className="w-[90px] mr-1" />
                            {/* Fixed-width avail text */}
                            <span className={cn(
                              "text-xs w-[70px] text-right mr-2",
                              isBatchOverStock ? "text-red-600 font-medium" : "text-muted-foreground"
                            )}>
                              {batch.quantity} avail{isBatchOverStock && " ⚠"}
                            </span>
                            {/* Fixed-width quick buttons grid */}
                            <div className="hidden md:grid grid-cols-3 gap-1 w-[126px]">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-1 flex flex-col items-center justify-center leading-tight"
                                onClick={() => setBatchQtyDirect(varietyKey, variety, batch, quickQtyValues.halfShelf)}
                                title={`Half shelf (${quickQtyValues.halfShelf})`}
                              >
                                <span className="text-[9px] text-muted-foreground">½S</span>
                                <span className="text-[10px] font-medium">{quickQtyValues.halfShelf}</span>
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-1 flex flex-col items-center justify-center leading-tight"
                                onClick={() => setBatchQtyDirect(varietyKey, variety, batch, quickQtyValues.fullShelf)}
                                title={`Full shelf (${quickQtyValues.fullShelf})`}
                              >
                                <span className="text-[9px] text-muted-foreground">1S</span>
                                <span className="text-[10px] font-medium">{quickQtyValues.fullShelf}</span>
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-1 flex flex-col items-center justify-center leading-tight"
                                onClick={() => setBatchQtyDirect(varietyKey, variety, batch, quickQtyValues.fullTrolley)}
                                title={`Full trolley (${quickQtyValues.fullTrolley})`}
                              >
                                <span className="text-[9px] text-muted-foreground">1T</span>
                                <span className="text-[10px] font-medium">{quickQtyValues.fullTrolley}</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }) : selectedProduct ? (
            /* Fallback: Show batches directly when no named varieties */
            selectedProduct.batches.map((batch) => {
              const batchAlloc = varietyAllocations.get('')?.batchAllocations?.get(batch.id);
              const batchQty = batchAlloc?.qty || 0;
              const isBatchOverStock = batchQty > batch.quantity;

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
                      className={cn(
                        "h-7 w-16 text-xs text-center px-1",
                        isBatchOverStock && "border-red-400 bg-red-50"
                      )}
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
                    {/* Fixed-width spacer for alignment */}
                    <div className="w-[90px] mr-1" />
                    {/* Fixed-width avail text */}
                    <span className={cn(
                      "text-xs w-[70px] text-right mr-2",
                      isBatchOverStock ? "text-red-600 font-medium" : "text-muted-foreground"
                    )}>
                      {batch.quantity} avail{isBatchOverStock && " ⚠"}
                    </span>
                    {/* Fixed-width quick buttons grid */}
                    <div className="hidden md:grid grid-cols-3 gap-1 w-[126px]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-1 flex flex-col items-center justify-center leading-tight"
                        onClick={() => setBatchQtyDirect('', { name: '', family: null }, batch, quickQtyValues.halfShelf)}
                        title={`Half shelf (${quickQtyValues.halfShelf})`}
                      >
                        <span className="text-[10px] text-muted-foreground">½S</span>
                        <span className="text-xs font-medium">{quickQtyValues.halfShelf}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-1 flex flex-col items-center justify-center leading-tight"
                        onClick={() => setBatchQtyDirect('', { name: '', family: null }, batch, quickQtyValues.fullShelf)}
                        title={`Full shelf (${quickQtyValues.fullShelf})`}
                      >
                        <span className="text-[10px] text-muted-foreground">1S</span>
                        <span className="text-xs font-medium">{quickQtyValues.fullShelf}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-1 flex flex-col items-center justify-center leading-tight"
                        onClick={() => setBatchQtyDirect('', { name: '', family: null }, batch, quickQtyValues.fullTrolley)}
                        title={`Full trolley (${quickQtyValues.fullTrolley})`}
                      >
                        <span className="text-[10px] text-muted-foreground">1T</span>
                        <span className="text-xs font-medium">{quickQtyValues.fullTrolley}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : null}

          {/* Mixed (Picker's Choice) Row */}
          {hasVarietiesToShow && (
            <div className={cn(
              "border-t border-muted",
              isMixedOverStock ? "bg-red-50/50" : "bg-amber-50/50"
            )}>
              <div className="grid grid-cols-12 gap-2 items-center py-2 px-3">
                {/* Mixed Label */}
                <div className="col-span-5 md:col-span-4">
                  <div className={cn(
                    "text-sm font-medium",
                    isMixedOverStock ? "text-red-800" : "text-amber-800"
                  )}>Mixed (Picker&apos;s Choice)</div>
                  <div className={cn(
                    "text-[10px] italic",
                    isMixedOverStock ? "text-red-600" : "text-amber-600"
                  )}>Pickers select any available varieties</div>
                </div>

                {/* Mixed Quantity Controls */}
                <div className="col-span-4 md:col-span-3 flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setMixedQty(prev => Math.max(0, prev - 10))}
                    disabled={mixedQty === 0}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    min="0"
                    className={cn(
                      "h-7 w-16 text-xs text-center px-1",
                      isMixedOverStock && "border-red-400 bg-red-50"
                    )}
                    value={mixedQty || ''}
                    onChange={(e) => setMixedQty(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setMixedQty(prev => prev + 10)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* Quick Fill Buttons - Fill to trolley targets */}
                <div className="col-span-3 md:col-span-5 flex items-center justify-end">
                  {/* Fixed-width spacer for alignment */}
                  <div className="w-[90px] mr-1" />
                  {/* Fixed-width status/avail text */}
                  <span className={cn(
                    "text-xs w-[70px] text-right mr-2",
                    isMixedOverStock ? "text-red-600 font-medium" : "text-amber-700"
                  )}>
                    {isMixedOverStock
                      ? `${Math.max(0, remainingForMixed)} avail ⚠`
                      : mixedQty > 0 ? `+${mixedQty} mixed` : ''
                    }
                  </span>
                  {/* Fixed-width quick fill buttons grid - using 2 cols for ½T and 1T */}
                  <div className="hidden md:grid grid-cols-3 gap-1 w-[126px]">
                    <div /> {/* Empty spacer for ½S column */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 px-1 flex flex-col items-center justify-center leading-tight",
                        isMixedOverStock
                          ? "bg-red-50 hover:bg-red-100 border-red-300"
                          : "bg-amber-50 hover:bg-amber-100 border-amber-300"
                      )}
                      onClick={() => {
                        const target = Math.round(quickQtyValues.fullTrolley / 2);
                        const remaining = Math.max(0, target - totalFromVarieties);
                        setMixedQty(remaining);
                      }}
                      title={`Fill to half trolley (${Math.round(quickQtyValues.fullTrolley / 2)})`}
                    >
                      <span className={cn("text-[10px]", isMixedOverStock ? "text-red-700" : "text-amber-700")}>½T</span>
                      <span className={cn("text-xs font-medium", isMixedOverStock ? "text-red-800" : "text-amber-800")}>{Math.round(quickQtyValues.fullTrolley / 2)}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 px-1 flex flex-col items-center justify-center leading-tight",
                        isMixedOverStock
                          ? "bg-red-50 hover:bg-red-100 border-red-300"
                          : "bg-amber-50 hover:bg-amber-100 border-amber-300"
                      )}
                      onClick={() => {
                        const remaining = Math.max(0, quickQtyValues.fullTrolley - totalFromVarieties);
                        setMixedQty(remaining);
                      }}
                      title={`Fill to full trolley (${quickQtyValues.fullTrolley})`}
                    >
                      <span className={cn("text-[10px]", isMixedOverStock ? "text-red-700" : "text-amber-700")}>1T</span>
                      <span className={cn("text-xs font-medium", isMixedOverStock ? "text-red-800" : "text-amber-800")}>{quickQtyValues.fullTrolley}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary Footer */}
          {totalWithMixed > 0 && (
            <div className="px-3 py-2 bg-background border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total selected:</span>
              <div className="flex items-center gap-2">
                {mixedQty > 0 && totalFromVarieties > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({totalFromVarieties} varieties + {mixedQty} mixed)
                  </span>
                )}
                <span className="text-sm font-semibold">{totalWithMixed}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
