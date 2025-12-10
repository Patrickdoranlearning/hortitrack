'use client';

import { useMemo, useState } from 'react';
import { UseFormReturn, useWatch } from 'react-hook-form';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Layers, Trash2 } from 'lucide-react';
import { BatchSelectionDialog, BatchAllocation } from '../BatchSelectionDialog';
import type { ProductWithBatches } from '@/server/sales/products-with-batches';
import type { CreateOrderInput } from '@/lib/sales/types';
import { cn } from '@/lib/utils';

type Props = {
  index: number;
  form: UseFormReturn<CreateOrderInput>;
  products: ProductWithBatches[];
  filteredProducts: ProductWithBatches[];
  allocations: BatchAllocation[];
  onAllocationsChange: (index: number, allocations: BatchAllocation[]) => void;
  onRemove: () => void;
  selectedCustomerId?: string;
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
}: Props) {
  const [open, setOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  const line = useWatch({ control: form.control, name: `lines.${index}` });

  const selectedProduct = useMemo(() => {
    if (!line?.productId) return undefined;
    return products.find((p) => p.id === line.productId);
  }, [line?.productId, products]);

  const varietyOptions = useMemo(() => {
    if (!selectedProduct) return [];
    return Array.from(new Set(selectedProduct.batches.map((b) => b.plantVariety).filter(Boolean)));
  }, [selectedProduct]);

  const selectedVariety = line?.plantVariety || 'any';
  const qty = typeof line?.qty === 'number' ? line.qty : Number(line?.qty) || 0;
  const price = typeof line?.unitPrice === 'number' ? line.unitPrice : Number(line?.unitPrice) || 0;
  const vatRate = typeof line?.vatRate === 'number' ? line.vatRate : Number(line?.vatRate) || 0;
  const lineNet = qty * price;
  const lineVat = lineNet * (vatRate / 100);
  const lineTotal = lineNet + lineVat;

  const batchDialogBatches =
    selectedProduct?.batches.filter((b) => (selectedVariety && selectedVariety !== 'any' ? b.plantVariety === selectedVariety : true)) || [];

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
    if (product.defaultPrice != null) {
      return product.defaultPrice;
    }
    return undefined;
  };

  const handleBatchConfirm = (allocs: BatchAllocation[]) => {
    onAllocationsChange(index, allocs);
    if (allocs.length > 0) {
      const totalQty = allocs.reduce((sum, a) => sum + a.qty, 0);
      form.setValue(`lines.${index}.qty`, totalQty);
      form.setValue(
        `lines.${index}.preferredBatchNumbers`,
        allocs.map((a) => a.batchNumber)
      );
      if (allocs.length === 1) {
        form.setValue(`lines.${index}.requiredBatchId`, allocs[0].batchId);
      } else {
        form.setValue(`lines.${index}.requiredBatchId`, undefined);
      }
    }
  };

  return (
    <Accordion type="single" collapsible value={open ? `line-${index}` : ''} onValueChange={(v) => setOpen(Boolean(v))}>
      <AccordionItem value={`line-${index}`} className="border rounded-lg px-4">
        <AccordionTrigger className="py-3 hover:no-underline">
          <div className="grid grid-cols-12 gap-3 w-full items-center">
            <div className="col-span-4 text-left">
              <div className="text-sm font-medium">
                {selectedProduct ? resolveProductLabel(selectedProduct) : 'Select product'}
              </div>
              {selectedProduct && (
                <div className="text-xs text-muted-foreground">
                  {selectedProduct.availableStock} available • {selectedProduct.size}
                </div>
              )}
            </div>
            <div className="col-span-2 text-sm text-muted-foreground text-right">{qty || 0} qty</div>
            <div className="col-span-2 text-sm text-muted-foreground text-right">€{price.toFixed(2)}</div>
            <div className="col-span-2 text-sm text-muted-foreground text-right">VAT {vatRate}%</div>
            <div className="col-span-2 text-sm font-semibold text-right">€{lineTotal.toFixed(2)}</div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <div className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-4 space-y-2">
              <FormField
                control={form.control}
                name={`lines.${index}.productId`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product *</FormLabel>
                    <Select
                      value={field.value || ''}
                      onValueChange={(val) => {
                        field.onChange(val);
                        const product = products.find((p) => p.id === val);
                        if (product) {
                          form.setValue(`lines.${index}.plantVariety`, product.plantVariety);
                          form.setValue(`lines.${index}.size`, product.size);
                          const price = getProductPrice(product);
                          if (price !== undefined) {
                            form.setValue(`lines.${index}.unitPrice`, price);
                          }
                        }
                        onAllocationsChange(index, []);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {resolveProductLabel(product)}{' '}
                            <span className="text-xs text-muted-foreground">({product.availableStock} avail)</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedProduct && varietyOptions.length > 0 && (
                <FormField
                  control={form.control}
                  name={`lines.${index}.plantVariety`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Variety</FormLabel>
                      <Select
                        value={field.value || 'any'}
                        onValueChange={(val) => {
                          field.onChange(val);
                          onAllocationsChange(index, []);
                          form.setValue(`lines.${index}.requiredBatchId`, undefined);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Any / Assorted" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="any">Any / Assorted</SelectItem>
                          {varietyOptions.map((name) => (
                            <SelectItem key={name} value={name!}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name={`lines.${index}.description`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Description (optional)" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="col-span-8 grid grid-cols-12 gap-3">
              <div className="col-span-3">
                <FormField
                  control={form.control}
                  name={`lines.${index}.qty`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-3">
                <FormField
                  control={form.control}
                  name={`lines.${index}.unitPrice`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-3">
                <FormField
                  control={form.control}
                  name={`lines.${index}.vatRate`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT %</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-3 flex items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setBatchDialogOpen(true)}
                  disabled={!selectedProduct}
                >
                  <Layers className="h-4 w-4 mr-2" />
                  {allocations.length > 0 ? `${allocations.length} batch(es)` : 'Select batches'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="self-start"
                  onClick={onRemove}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              {allocations.length > 0 && (
                <div className="col-span-12 flex flex-wrap gap-2">
                  {allocations.slice(0, 3).map((a) => (
                    <Badge key={a.batchId} variant="secondary">
                      {a.batchNumber}: {a.qty}
                    </Badge>
                  ))}
                  {allocations.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{allocations.length - 3} more
                    </Badge>
                  )}
                </div>
              )}

              <div className="col-span-12 text-sm text-muted-foreground">
                Line total: <span className="font-semibold text-foreground">€{lineTotal.toFixed(2)}</span> (VAT €{lineVat.toFixed(2)})
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <BatchSelectionDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        batches={batchDialogBatches}
        productName={selectedProduct ? resolveProductLabel(selectedProduct) : ''}
        productVariety={selectedVariety === 'any' ? selectedProduct?.plantVariety || '' : selectedVariety}
        productSize={selectedProduct?.size || ''}
        currentAllocations={allocations}
        onConfirm={handleBatchConfirm}
      />
    </Accordion>
  );
}
