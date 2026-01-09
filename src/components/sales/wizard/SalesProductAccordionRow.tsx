'use client';

import { useEffect, useMemo, useState } from 'react';
import { UseFormReturn, useWatch } from 'react-hook-form';
import { FormControl, FormField } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Trash2, Layers } from 'lucide-react';
import { BatchSelectionDialog, BatchAllocation } from '../BatchSelectionDialog';
import type { ProductWithBatches } from '@/server/sales/products-with-batches';
import type { CreateOrderInput } from '@/lib/sales/types';
import { cn } from '@/lib/utils';

export type PricingHint = {
  rrp?: number | null;
  multibuyQty2?: number | null;
  multibuyPrice2?: number | null;
};

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
};

// Track variety quantities locally
type VarietyQty = {
  varietyName: string;
  qty: number;
  batchAllocations: BatchAllocation[];
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
}: Props) {
  const line = useWatch({ control: form.control, name: `lines.${index}` });
  const [varietiesExpanded, setVarietiesExpanded] = useState(false);
  const [varietyQuantities, setVarietyQuantities] = useState<VarietyQty[]>([]);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [selectedVarietyForBatches, setSelectedVarietyForBatches] = useState<string>('');

  const selectedProduct = useMemo(() => {
    if (!line?.productId) return undefined;
    return products.find((p) => p.id === line.productId);
  }, [line?.productId, products]);

  // Get unique varieties from batches with family info
  const varietiesWithFamily = useMemo(() => {
    if (!selectedProduct) return [];
    const varietyMap = new Map<string, { name: string; family: string | null }>();
    for (const batch of selectedProduct.batches) {
      if (batch.plantVariety && !varietyMap.has(batch.plantVariety)) {
        varietyMap.set(batch.plantVariety, {
          name: batch.plantVariety,
          family: batch.family || selectedProduct.family || null
        });
      }
    }
    return Array.from(varietyMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedProduct]);

  // Simple list of variety names for backward compatibility
  const varieties = varietiesWithFamily.map(v => v.name);

  // Get stock info per variety
  const varietyStockInfo = useMemo(() => {
    if (!selectedProduct) return new Map<string, { totalQty: number; batchCount: number; family: string | null }>();
    const info = new Map<string, { totalQty: number; batchCount: number; family: string | null }>();
    
    for (const batch of selectedProduct.batches) {
      const varietyName = batch.plantVariety || '';
      if (!info.has(varietyName)) {
        info.set(varietyName, { totalQty: 0, batchCount: 0, family: batch.family || null });
      }
      const existing = info.get(varietyName)!;
      existing.totalQty += batch.quantity;
      existing.batchCount += 1;
    }
    
    return info;
  }, [selectedProduct]);

  // Initialize variety quantities when product changes
  useEffect(() => {
    if (selectedProduct && varieties.length > 0) {
      setVarietyQuantities([
        { varietyName: '', qty: 0, batchAllocations: [] }, // Grower's Choice
        ...varieties.map(v => ({ varietyName: v, qty: 0, batchAllocations: [] }))
      ]);
    } else {
      setVarietyQuantities([]);
    }
  }, [selectedProduct?.id, varieties.length]);

  // Calculate total from variety quantities
  const varietyTotal = varietyQuantities.reduce((sum, v) => sum + v.qty, 0);
  
  // Use variety total if expanded, otherwise use form qty
  const displayQty = varietiesExpanded && varietyTotal > 0 ? varietyTotal : (line?.qty || 0);
  const price = typeof line?.unitPrice === 'number' ? line.unitPrice : Number(line?.unitPrice) || 0;
  const vatRate = typeof line?.vatRate === 'number' ? line.vatRate : Number(line?.vatRate) || 0;
  const lineNet = displayQty * price;
  const lineVat = lineNet * (vatRate / 100);
  const lineTotal = lineNet + lineVat;

  // Sync variety total to form
  useEffect(() => {
    if (varietiesExpanded && varietyTotal > 0) {
      form.setValue(`lines.${index}.qty`, varietyTotal);
    }
  }, [varietyTotal, varietiesExpanded, form, index]);

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
    onAllocationsChange(index, []);
    setVarietiesExpanded(false);
    setVarietyQuantities([]);
  };

  const handleMainQtyChange = (newQty: number) => {
    form.setValue(`lines.${index}.qty`, Math.max(0, newQty));
    // If varieties were expanded but user edits main qty, collapse varieties
    if (varietiesExpanded && varietyTotal > 0) {
      setVarietiesExpanded(false);
      setVarietyQuantities(prev => prev.map(v => ({ ...v, qty: 0, batchAllocations: [] })));
    }
    onAllocationsChange(index, []);
  };

  const handleVarietyQtyChange = (varietyName: string, newQty: number) => {
    setVarietyQuantities(prev => 
      prev.map(v => 
        v.varietyName === varietyName 
          ? { ...v, qty: Math.max(0, newQty) }
          : v
      )
    );
  };

  const openBatchDialog = (varietyName: string) => {
    setSelectedVarietyForBatches(varietyName);
    setBatchDialogOpen(true);
  };

  const handleBatchConfirm = (allocs: BatchAllocation[]) => {
    // Update the variety's batch allocations
    setVarietyQuantities(prev =>
      prev.map(v =>
        v.varietyName === selectedVarietyForBatches
          ? { 
              ...v, 
              batchAllocations: allocs,
              qty: allocs.reduce((sum, a) => sum + a.qty, 0) || v.qty
            }
          : v
      )
    );
    
    // Update the overall allocations
    const otherAllocations = allocations.filter(a => {
      const batch = selectedProduct?.batches.find(b => b.id === a.batchId);
      return batch?.plantVariety !== selectedVarietyForBatches && 
             (selectedVarietyForBatches !== '' || batch?.plantVariety);
    });
    onAllocationsChange(index, [...otherAllocations, ...allocs]);
  };

  const batchDialogBatches = useMemo(() => {
    if (!selectedProduct) return [];
    if (selectedVarietyForBatches === '') {
      return selectedProduct.batches; // All batches for Grower's Choice
    }
    return selectedProduct.batches.filter(b => b.plantVariety === selectedVarietyForBatches);
  }, [selectedProduct, selectedVarietyForBatches]);

  const getVarietyAllocations = (varietyName: string) => {
    return allocations.filter(a => {
      const batch = selectedProduct?.batches.find(b => b.id === a.batchId);
      if (varietyName === '') return !batch?.plantVariety || batch.plantVariety === '';
      return batch?.plantVariety === varietyName;
    });
  };

  return (
    <div className="border-b last:border-b-0">
      {/* Main Product Row - Excel-like */}
      <div className="grid grid-cols-12 gap-1 md:gap-2 items-center py-2 px-2 md:px-3 hover:bg-muted/30">
        {/* Product Select - col 1-6 mobile, 1-4 desktop */}
        <div className="col-span-6 md:col-span-4">
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

        {/* Quantity - col 7-8 mobile, 5 desktop */}
        <div className="col-span-2 md:col-span-1">
          <FormField
            control={form.control}
            name={`lines.${index}.qty`}
            render={({ field }) => (
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  className={cn(
                    "h-9 text-xs md:text-sm text-center px-1",
                    varietiesExpanded && varietyTotal > 0 && "bg-muted text-muted-foreground"
                  )}
                  value={displayQty || ''}
                  onChange={(e) => handleMainQtyChange(parseInt(e.target.value) || 0)}
                  readOnly={varietiesExpanded && varietyTotal > 0}
                  placeholder="0"
                />
              </FormControl>
            )}
          />
        </div>

        {/* Price - col 6 desktop, hidden mobile */}
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

        {/* VAT % - col 7 desktop, hidden mobile */}
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

        {/* Total - col 8 desktop, hidden mobile */}
        <div className="hidden md:block md:col-span-1 text-right text-sm font-medium">
          €{lineTotal.toFixed(2)}
        </div>

        {/* Varieties Dropdown Button - col 9-12 mobile, 9-12 desktop */}
        <div className="col-span-4 md:col-span-4 flex items-center justify-end gap-1">
          {/* Always show varieties selector, disabled when no product or no varieties */}
          <Button
            type="button"
            variant={varietiesExpanded ? "secondary" : "outline"}
            size="sm"
            className={cn(
              "h-8 px-1.5 md:px-3 text-[10px] md:text-xs min-w-[70px] md:min-w-[100px] justify-between",
              (!selectedProduct || varieties.length === 0) && "opacity-50"
            )}
            onClick={() => selectedProduct && varieties.length > 0 && setVarietiesExpanded(!varietiesExpanded)}
            disabled={!selectedProduct || varieties.length === 0}
          >
            <span className="truncate mr-1">
              {!selectedProduct 
                ? "Varieties" 
                : varieties.length === 0 
                  ? "None" 
                  : varietiesExpanded 
                    ? `${varieties.length}`
                    : "▾ Var"
              }
            </span>
            {selectedProduct && varieties.length > 0 && (
              varietiesExpanded ? (
                <ChevronDown className="h-3 w-3 shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0" />
              )
            )}
          </Button>
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

      {/* Variety Sub-Rows - Expanded */}
      {varietiesExpanded && selectedProduct && (
        <div className="bg-muted/20 border-t">
          {/* Grower's Choice Row */}
          <VarietyRow
            varietyName=""
            displayName="Grower's Choice"
            family={null}
            qty={varietyQuantities.find(v => v.varietyName === '')?.qty || 0}
            stockInfo={{ totalQty: selectedProduct.availableStock, batchCount: selectedProduct.batches.length, family: null }}
            allocations={getVarietyAllocations('')}
            onQtyChange={(qty) => handleVarietyQtyChange('', qty)}
            onBatchClick={() => openBatchDialog('')}
            isLast={varieties.length === 0}
          />
          
          {/* Individual Variety Rows */}
          {varietiesWithFamily.map((variety, idx) => {
            const stockInfo = varietyStockInfo.get(variety.name);
            return (
              <VarietyRow
                key={variety.name}
                varietyName={variety.name}
                displayName={variety.name}
                family={variety.family}
                qty={varietyQuantities.find(v => v.varietyName === variety.name)?.qty || 0}
                stockInfo={stockInfo}
                allocations={getVarietyAllocations(variety.name)}
                onQtyChange={(qty) => handleVarietyQtyChange(variety.name, qty)}
                onBatchClick={() => openBatchDialog(variety.name)}
                isLast={idx === varietiesWithFamily.length - 1}
              />
            );
          })}
        </div>
      )}

      {/* Batch Selection Dialog */}
      <BatchSelectionDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        batches={batchDialogBatches}
        productName={selectedProduct ? resolveProductLabel(selectedProduct) : ''}
        productVariety={selectedVarietyForBatches || 'Any'}
        productSize={selectedProduct?.size || ''}
        currentAllocations={getVarietyAllocations(selectedVarietyForBatches)}
        onConfirm={handleBatchConfirm}
      />
    </div>
  );
}

// Sub-component for variety rows
function VarietyRow({
  varietyName,
  displayName,
  family,
  qty,
  stockInfo,
  allocations,
  onQtyChange,
  onBatchClick,
  isLast,
}: {
  varietyName: string;
  displayName: string;
  family: string | null;
  qty: number;
  stockInfo?: { totalQty: number; batchCount: number; family: string | null };
  allocations: BatchAllocation[];
  onQtyChange: (qty: number) => void;
  onBatchClick: () => void;
  isLast: boolean;
}) {
  return (
    <div className={cn(
      "grid grid-cols-12 gap-1 md:gap-2 items-center py-1.5 px-2 md:px-3 pl-4 md:pl-8",
      !isLast && "border-b border-muted"
    )}>
      {/* Tree connector + Variety Name + Family - col 1-6 mobile, 1-4 desktop */}
      <div className="col-span-6 md:col-span-4 flex items-center gap-1 md:gap-2 text-xs md:text-sm">
        <span className="text-muted-foreground shrink-0">{isLast ? '└' : '├'}</span>
        <div className="flex flex-col min-w-0">
          <span className={cn(
            "truncate",
            qty > 0 ? "font-medium" : "text-muted-foreground"
          )}>
            {displayName}
          </span>
          {family && (
            <span className="text-[9px] md:text-[10px] text-muted-foreground truncate">
              {family}
            </span>
          )}
        </div>
        <span className="text-[10px] md:text-xs text-muted-foreground shrink-0">
          ({stockInfo?.totalQty || 0})
        </span>
      </div>

      {/* Quantity Input - col 7-8 mobile, 5 desktop */}
      <div className="col-span-2 md:col-span-1">
        <Input
          type="number"
          min="0"
          className="h-8 text-xs md:text-sm text-center px-1"
          value={qty || ''}
          onChange={(e) => onQtyChange(parseInt(e.target.value) || 0)}
          placeholder="0"
        />
      </div>

      {/* Empty cols hidden on mobile, 6-9 desktop */}
      <div className="hidden md:block md:col-span-4" />

      {/* Batch Selection - col 9-12 mobile, 10-11 desktop */}
      <div className="col-span-4 md:col-span-3 flex justify-end">
        {qty > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 md:px-2 text-[10px] md:text-xs"
            onClick={onBatchClick}
          >
            <Layers className="h-3 w-3 mr-1 shrink-0" />
            <span className="truncate">
              {allocations.length > 0 ? `${allocations.length}b` : 'Batch'}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}
