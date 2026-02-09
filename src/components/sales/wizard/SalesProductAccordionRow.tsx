'use client';

import { useEffect, useMemo, useState } from 'react';
import { UseFormReturn, useWatch } from 'react-hook-form';
import { FormControl, FormField } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import type { ProductWithBatches } from '@/server/sales/products-with-batches';
import type { ProductGroupWithAvailability } from '@/server/sales/product-groups-with-availability';
import type { CreateOrderInput, VarietyBreakdown } from '@/lib/sales/types';
import { cn } from '@/lib/utils';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';

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
  fieldId?: string;
  index: number;
  form: UseFormReturn<CreateOrderInput>;
  products: ProductWithBatches[];
  productGroups?: ProductGroupWithAvailability[];
  filteredProducts: ProductWithBatches[];
  onRemove: () => void;
  selectedCustomerId?: string;
  currency?: CurrencyCode;
  defaultExpanded?: boolean;
  pricingHints?: Record<string, PricingHint>;
  quickQty?: QuickQtyConfig;
  varietyBreakdown?: VarietyBreakdown[];
  onVarietyQtyChange?: (key: string, qty: number) => void;
  onInitBreakdown?: (group: ProductGroupWithAvailability) => void;
  onInitProductBreakdown?: (product: ProductWithBatches, varieties: Array<{varietyId?: string; name: string; stock: number}>) => void;
};

export function SalesProductAccordionRow({
  fieldId,
  index,
  form,
  products,
  productGroups = [],
  filteredProducts,
  onRemove,
  selectedCustomerId,
  currency = 'EUR',
  pricingHints = {},
  quickQty = DEFAULT_quickQty,
  varietyBreakdown,
  onVarietyQtyChange,
  onInitBreakdown,
  onInitProductBreakdown,
}: Props) {
  const line = useWatch({ control: form.control, name: `lines.${index}` });
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedProduct = useMemo(() => {
    if (!line?.productId) return undefined;
    return products.find((p) => p.id === line.productId);
  }, [line?.productId, products]);

  // Check if a product group is selected
  const selectedProductGroup = useMemo(() => {
    if (!line?.productGroupId) return undefined;
    return productGroups.find((g) => g.id === line.productGroupId);
  }, [line?.productGroupId, productGroups]);

  // Auto-initialize variety breakdown when product group is already selected
  // (e.g., when restoring from draft) but breakdown hasn't been populated yet
  useEffect(() => {
    if (selectedProductGroup && onInitBreakdown && (!varietyBreakdown || varietyBreakdown.length === 0)) {
      onInitBreakdown(selectedProductGroup);
    }
  }, [selectedProductGroup, varietyBreakdown, onInitBreakdown]);

  // Auto-initialize variety breakdown for regular products with multiple varieties
  useEffect(() => {
    if (selectedProduct && !selectedProductGroup && onInitProductBreakdown && (!varietyBreakdown || varietyBreakdown.length === 0)) {
      // Only initialize if product has 2+ varieties
      const varieties = new Map<string, { varietyId?: string; name: string; stock: number }>();
      for (const batch of selectedProduct.batches) {
        const name = batch.plantVariety || '';
        if (name) {
          if (!varieties.has(name)) {
            varieties.set(name, { varietyId: batch.plantVarietyId, name, stock: 0 });
          }
          varieties.get(name)!.stock += batch.quantity;
        }
      }
      if (varieties.size >= 2) {
        onInitProductBreakdown(selectedProduct, Array.from(varieties.values()));
      }
    }
  }, [selectedProduct, selectedProductGroup, varietyBreakdown, onInitProductBreakdown]);

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

  // Simple display quantity - just use form qty
  const displayQty = line?.qty || 0;

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
        return [
          child.productId,
          {
            name: child.productName,
            totalStock: child.availableStock,
          },
        ] as const;
      }).sort((a, b) => a[1].name.localeCompare(b[1].name));
    }

    // Regular product - group batches by variety
    if (!selectedProduct) return [];

    const varietyMap = new Map<string, {
      name: string;
      varietyId?: string;
      totalStock: number;
    }>();

    // Group batches by variety
    for (const batch of selectedProduct.batches) {
      const varietyName = batch.plantVariety || '';
      if (varietyName) {
        if (!varietyMap.has(varietyName)) {
          varietyMap.set(varietyName, {
            name: varietyName,
            varietyId: batch.plantVarietyId,
            totalStock: 0,
          });
        }
        const variety = varietyMap.get(varietyName)!;
        variety.totalStock += batch.quantity;
      }
    }

    // Sort varieties alphabetically
    return Array.from(varietyMap.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [selectedProduct, selectedProductGroup]);

  // Check if product has varieties to show (at least 1 variety with a name)
  const hasVarietiesToShow = varietiesWithBatches.length >= 1;

  const price = typeof line?.unitPrice === 'number' ? line.unitPrice : Number(line?.unitPrice) || 0;
  const vatRate = typeof line?.vatRate === 'number' ? line.vatRate : Number(line?.vatRate) || 0;
  const lineNet = displayQty * price;
  const lineVat = lineNet * (vatRate / 100);
  const lineTotal = lineNet + lineVat;

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
        form.setValue(`lines.${index}.size`, '');
        form.setValue(`lines.${index}.description`, `${group.name} (Mix)`);

        // Check for customer-specific alias price first
        let groupPrice: number | undefined;
        if (selectedCustomerId && group.aliases) {
          const customerAlias = group.aliases.find(
            (a) => a.isActive && a.customerId === selectedCustomerId && a.unitPriceExVat != null
          );
          if (customerAlias?.unitPriceExVat != null) {
            groupPrice = customerAlias.unitPriceExVat;
          }
        }
        // Fall back to default price from first child product
        if (groupPrice === undefined && group.defaultPrice != null) {
          groupPrice = group.defaultPrice;
        }
        if (groupPrice !== undefined) {
          form.setValue(`lines.${index}.unitPrice`, groupPrice);
        }
      }

      // Initialize variety breakdown for this product group
      if (group && onInitBreakdown) {
        onInitBreakdown(group);
      }

      setIsExpanded(true); // Auto-expand to show child products
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
    setIsExpanded(false);
  };

  const handleMainQtyChange = (newQty: number) => {
    form.setValue(`lines.${index}.qty`, Math.max(0, newQty));
  };

  // Get total available stock (from product or group)
  const totalAvailableStock = selectedProductGroup
    ? selectedProductGroup.availableStock
    : (selectedProduct?.netAvailableStock ?? selectedProduct?.availableStock ?? 0);

  // Over-stock detection for main product row
  const isProductOverStock = (selectedProduct || selectedProductGroup) && displayQty > totalAvailableStock;

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
          {formatCurrency(lineTotal, currency)}
        </div>

        {/* Quick Qty, Expand/Collapse & Delete */}
        <div className="col-span-5 md:col-span-4 flex items-center gap-1">
          {/* Quick Qty Buttons - anchored to left of column for alignment with variety rows */}
          {selectedProduct && (
            <div className="hidden md:grid grid-cols-3 gap-1 w-[126px]">
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
          {/* Spacer pushes expand/delete to the right */}
          <div className="flex-1" />
          {/* Expand/Collapse button for variety info */}
          {(selectedProduct || selectedProductGroup) && hasVarietiesToShow && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-2 text-xs gap-1",
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
                {`${varietiesWithBatches.length} ${selectedProductGroup ? 'product' : 'variet'}${varietiesWithBatches.length > 1 ? (selectedProductGroup ? 's' : 'ies') : (selectedProductGroup ? '' : 'y')}`}
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

      {/* Expanded Panel: Product Group with Variety Quantity Inputs */}
      {isExpanded && selectedProductGroup && varietyBreakdown && varietyBreakdown.length > 0 && (
        <div className="bg-muted/20 border-t px-3 py-2 space-y-1">
          {varietyBreakdown.map((variety) => {
            const specifiedTotal = varietyBreakdown.reduce((sum, v) => sum + v.qty, 0);
            return (
              <div key={variety.productId} className="flex items-center gap-2 text-sm py-1">
                <span className="text-muted-foreground flex-1 truncate">{variety.productName}</span>
                <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                  {variety.availableStock} avail
                </span>
                <Input
                  type="number"
                  min={0}
                  className={cn(
                    "h-7 w-20 text-xs text-center shrink-0",
                    variety.qty > variety.availableStock && "border-amber-400 bg-amber-50",
                    specifiedTotal > displayQty && variety.qty > 0 && "border-red-400 bg-red-50"
                  )}
                  value={variety.qty || ''}
                  onChange={(e) => onVarietyQtyChange?.(
                    variety.productId,
                    Math.max(0, parseInt(e.target.value) || 0)
                  )}
                  placeholder="0"
                />
              </div>
            );
          })}

          {/* Summary Bar */}
          {(() => {
            const specifiedTotal = varietyBreakdown.reduce((sum, v) => sum + v.qty, 0);
            const remainder = displayQty - specifiedTotal;
            return (
              <div className="flex items-center justify-between pt-2 border-t text-xs">
                <span className={cn(
                  "font-medium",
                  specifiedTotal > displayQty && "text-red-600"
                )}>
                  Specified: {specifiedTotal} of {displayQty}
                </span>
                {specifiedTotal > displayQty && (
                  <span className="text-red-600 font-medium">
                    Over-allocated by {specifiedTotal - displayQty}
                  </span>
                )}
                {remainder > 0 && specifiedTotal > 0 && (
                  <span className="text-muted-foreground">
                    Grower&apos;s Choice: {remainder}
                  </span>
                )}
                {remainder === 0 && specifiedTotal === displayQty && specifiedTotal > 0 && (
                  <span className="text-green-600 font-medium">
                    Fully specified
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Expanded Varieties Panel with editable inputs (regular products) */}
      {isExpanded && selectedProduct && !selectedProductGroup && varietyBreakdown && varietyBreakdown.length > 0 && (
        <div className="bg-muted/20 border-t py-2">
          {varietyBreakdown.map((variety) => {
            const specifiedTotal = varietyBreakdown.reduce((sum, v) => sum + v.qty, 0);
            return (
              <div key={variety.varietyId || variety.productName} className="grid grid-cols-12 gap-1 md:gap-2 items-center py-1 px-2 md:px-3">
                {/* Variety name + avail - spans left 8 columns (md) to match product+qty+price+vat+total */}
                <div className="col-span-7 md:col-span-8 flex items-center gap-2 text-sm min-w-0">
                  <span className="text-muted-foreground truncate">{variety.productName}</span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {variety.availableStock} avail
                  </span>
                </div>
                {/* Quick qty + input - same col-span-4 as product row */}
                <div className="col-span-5 md:col-span-4 flex items-center gap-1">
                  <div className="hidden md:grid grid-cols-3 gap-1 w-[126px]">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-1 flex flex-col items-center justify-center leading-tight"
                      onClick={() => onVarietyQtyChange?.(
                        variety.varietyId || variety.productName,
                        quickQtyValues.halfShelf
                      )}
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
                      onClick={() => onVarietyQtyChange?.(
                        variety.varietyId || variety.productName,
                        quickQtyValues.fullShelf
                      )}
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
                      onClick={() => onVarietyQtyChange?.(
                        variety.varietyId || variety.productName,
                        quickQtyValues.fullTrolley
                      )}
                      title={`Full trolley (${quickQtyValues.fullTrolley})`}
                    >
                      <span className="text-[10px] text-muted-foreground">1T</span>
                      <span className="text-xs font-medium">{quickQtyValues.fullTrolley}</span>
                    </Button>
                  </div>
                  <div className="flex-1" />
                  <Input
                    type="number"
                    min={0}
                    className={cn(
                      "h-9 w-20 text-xs text-center shrink-0",
                      variety.qty > variety.availableStock && "border-amber-400 bg-amber-50",
                      specifiedTotal > displayQty && variety.qty > 0 && "border-red-400 bg-red-50"
                    )}
                    value={variety.qty || ''}
                    onChange={(e) => onVarietyQtyChange?.(
                      variety.varietyId || variety.productName,
                      Math.max(0, parseInt(e.target.value) || 0)
                    )}
                    placeholder="0"
                  />
                </div>
              </div>
            );
          })}

          {/* Summary Bar */}
          {(() => {
            const specifiedTotal = varietyBreakdown.reduce((sum, v) => sum + v.qty, 0);
            const remainder = displayQty - specifiedTotal;
            return (
              <div className="flex items-center justify-between pt-2 mx-2 md:mx-3 border-t text-xs">
                <span className={cn(
                  "font-medium",
                  specifiedTotal > displayQty && "text-red-600"
                )}>
                  Specified: {specifiedTotal} of {displayQty}
                </span>
                {specifiedTotal > displayQty && (
                  <span className="text-red-600 font-medium">
                    Over-allocated by {specifiedTotal - displayQty}
                  </span>
                )}
                {remainder > 0 && specifiedTotal > 0 && (
                  <span className="text-muted-foreground">
                    Grower&apos;s Choice: {remainder}
                  </span>
                )}
                {remainder === 0 && specifiedTotal === displayQty && specifiedTotal > 0 && (
                  <span className="text-green-600 font-medium">
                    Fully specified
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Fallback: Regular product without breakdown data (read-only) */}
      {isExpanded && selectedProduct && !selectedProductGroup && (!varietyBreakdown || varietyBreakdown.length === 0) && hasVarietiesToShow && (
        <div className="bg-muted/20 border-t px-3 py-2 space-y-1">
          {varietiesWithBatches.map(([key, variety]) => (
            <div key={key} className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground">{variety.name}</span>
              <span className="text-xs text-muted-foreground">{variety.totalStock} avail</span>
            </div>
          ))}
        </div>
      )}

      {/* Fallback: Product group without breakdown data (read-only) */}
      {isExpanded && selectedProductGroup && (!varietyBreakdown || varietyBreakdown.length === 0) && hasVarietiesToShow && (
        <div className="bg-muted/20 border-t px-3 py-2 space-y-1">
          {varietiesWithBatches.map(([key, variety]) => (
            <div key={key} className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground">{variety.name}</span>
              <span className="text-xs text-muted-foreground">{variety.totalStock} avail</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
