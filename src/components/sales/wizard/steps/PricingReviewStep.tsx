'use client';

import { useState, useMemo, useEffect } from 'react';
import { FieldArrayWithId, UseFormReturn, useWatch } from 'react-hook-form';
import type { CreateOrderInput, OrderFeeInput } from '@/lib/sales/types';
import type { ProductWithBatches } from '@/server/sales/products-with-batches';
import type { OrgFee } from '@/app/settings/fees/actions';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Tag } from 'lucide-react';
import { formatCurrency, currencySymbol, type CurrencyCode } from '@/lib/format-currency';

type CustomerPrePricingSettings = {
  prePricingFoc: boolean;
  prePricingCostPerLabel: number | null;
};

type Props = {
  form: UseFormReturn<CreateOrderInput>;
  totals: { net: number; vat: number; total: number };
  lines: FieldArrayWithId<CreateOrderInput, 'lines', 'id'>[];
  products: ProductWithBatches[];
  selectedCustomerId?: string;
  currency?: CurrencyCode;
  defaultShowRrp?: boolean;
  fees?: OrgFee[];
  customerPrePricing?: CustomerPrePricingSettings;
  onFeesChange?: (fees: OrderFeeInput[]) => void;
};

export function PricingReviewStep({
  form,
  totals,
  lines,
  products,
  selectedCustomerId,
  currency = 'EUR',
  defaultShowRrp = true,
  fees = [],
  customerPrePricing,
  onFeesChange,
}: Props) {
  const fc = (amount: number) => formatCurrency(amount, currency);
  const sym = currencySymbol(currency);
  const watchedLines = useWatch({ control: form.control, name: 'lines' });

  // Get fee configurations — filter by currency match (or fees with no currency set)
  // Memoize to prevent infinite re-render loops (new array refs trigger useEffect deps)
  const currencyFees = useMemo(
    () => fees.filter(f => !f.currency || f.currency === currency),
    [fees, currency]
  );
  const prePricingFee = useMemo(
    () => currencyFees.find(f => f.feeType === 'pre_pricing' && f.isActive),
    [currencyFees]
  );
  const deliveryFees = useMemo(
    () => currencyFees.filter(f => f.feeType.includes('delivery') && f.isActive),
    [currencyFees]
  );
  
  // Track RRP toggle state separately for better UX
  const [rrpEnabled, setRrpEnabled] = useState<Record<number, boolean>>(() => {
    // Initialize based on existing RRP values or customer default
    // Priority: existing RRP value > customer preference > org default
    const initial: Record<number, boolean> = {};
    lines.forEach((_, index) => {
      const watched = watchedLines?.[index];
      // If line has RRP value, enable. Otherwise use customer preference, falling back to org default
      initial[index] = watched?.rrp != null ? true : (defaultShowRrp || prePricingFee?.isDefault || false);
    });
    return initial;
  });

  // Track selected delivery fee
  const [selectedDeliveryFeeId, setSelectedDeliveryFeeId] = useState<string>(() => {
    const defaultDelivery = deliveryFees.find(f => f.isDefault);
    return defaultDelivery?.id || '';
  });

  // Calculate pre-pricing fee (considering customer-specific settings)
  const prePricingInfo = useMemo(() => {
    if (!prePricingFee) return { totalUnits: 0, fee: 0, vatAmount: 0, isFoc: false, ratePerUnit: 0 };

    let totalUnits = 0;
    watchedLines?.forEach((line, index) => {
      if (rrpEnabled[index] && line?.rrp != null) {
        const qty = typeof line.qty === 'number' ? line.qty : Number(line.qty) || 0;
        totalUnits += qty;
      }
    });

    // Check if customer has FOC (Free of Charge) pre-pricing
    const isFoc = customerPrePricing?.prePricingFoc ?? false;

    // Determine the rate per unit: customer-specific > org default
    const ratePerUnit = isFoc
      ? 0
      : (customerPrePricing?.prePricingCostPerLabel ?? prePricingFee.amount);

    const fee = totalUnits * ratePerUnit;
    const vatAmount = fee * (prePricingFee.vatRate / 100);

    return { totalUnits, fee, vatAmount, isFoc, ratePerUnit };
  }, [watchedLines, rrpEnabled, prePricingFee, customerPrePricing]);

  // Calculate delivery fee
  const deliveryInfo = useMemo((): { fee: number; vatAmount: number; name: string; waived: boolean; minValue?: number } => {
    if (!selectedDeliveryFeeId || selectedDeliveryFeeId === '__none__') {
      return { fee: 0, vatAmount: 0, name: '', waived: false };
    }
    
    const deliveryFee = deliveryFees.find(f => f.id === selectedDeliveryFeeId);
    if (!deliveryFee) return { fee: 0, vatAmount: 0, name: '', waived: false };
    
    // Check if order value exceeds minimum for free delivery
    const orderValue = totals.net;
    if (deliveryFee.minOrderValue && orderValue >= deliveryFee.minOrderValue) {
      return { fee: 0, vatAmount: 0, name: deliveryFee.name, waived: true, minValue: deliveryFee.minOrderValue };
    }
    
    const fee = deliveryFee.amount;
    const vatAmount = fee * (deliveryFee.vatRate / 100);
    return { fee, vatAmount, name: deliveryFee.name, waived: false };
  }, [selectedDeliveryFeeId, deliveryFees, totals.net]);

  // Calculate grand total with fees
  const grandTotal = useMemo(() => {
    const feesNet = prePricingInfo.fee + deliveryInfo.fee;
    const feesVat = prePricingInfo.vatAmount + deliveryInfo.vatAmount;
    return {
      productsNet: totals.net,
      productsVat: totals.vat,
      feesNet,
      feesVat,
      totalNet: totals.net + feesNet,
      totalVat: totals.vat + feesVat,
      grandTotal: totals.net + totals.vat + feesNet + feesVat,
    };
  }, [totals, prePricingInfo, deliveryInfo]);

  // Surface computed fees to parent for order submission
  useEffect(() => {
    if (!onFeesChange) return;
    const computedFees: OrderFeeInput[] = [];

    // Pre-pricing fee
    if (prePricingInfo.totalUnits > 0 && prePricingFee) {
      computedFees.push({
        orgFeeId: prePricingFee.id,
        feeType: 'pre_pricing',
        name: 'Pre-pricing (RRP Labels)',
        quantity: prePricingInfo.totalUnits,
        unitAmount: prePricingInfo.ratePerUnit,
        unit: 'per_unit',
        vatRate: prePricingFee.vatRate,
        isFoc: prePricingInfo.isFoc,
      });
    }

    // Delivery fee
    if (selectedDeliveryFeeId && selectedDeliveryFeeId !== '__none__') {
      const deliveryFee = deliveryFees.find(f => f.id === selectedDeliveryFeeId);
      if (deliveryFee && !deliveryInfo.waived) {
        computedFees.push({
          orgFeeId: deliveryFee.id,
          feeType: deliveryFee.feeType,
          name: deliveryFee.name,
          quantity: 1,
          unitAmount: deliveryFee.amount,
          unit: 'flat',
          vatRate: deliveryFee.vatRate,
          isFoc: false,
        });
      }
    }

    onFeesChange(computedFees);
  }, [prePricingInfo, prePricingFee, deliveryInfo, selectedDeliveryFeeId, deliveryFees, onFeesChange]);

  const resolveProductName = (productId: string | undefined) => {
    if (!productId) return 'Product line';
    const product = products.find(p => p.id === productId);
    if (!product) return 'Product line';
    
    // Check for customer alias first
    if (selectedCustomerId) {
      const alias = product.aliases?.find(
        a => a.isActive !== false && a.customerId === selectedCustomerId && a.aliasName
      );
      if (alias?.aliasName) return alias.aliasName;
    }
    
    return product.name || `${product.plantVariety} - ${product.size}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Step 3: Pricing & Review</h2>
        <p className="text-sm text-muted-foreground">Confirm pricing, VAT, and pre-pricing (RRP) for pot labels.</p>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => {
          const watched = watchedLines?.[index];
          const qty = typeof watched?.qty === 'number' ? watched.qty : Number(watched?.qty) || 0;
          const price = typeof watched?.unitPrice === 'number' ? watched.unitPrice : Number(watched?.unitPrice) || 0;
          const vatRate = typeof watched?.vatRate === 'number' ? watched.vatRate : Number(watched?.vatRate) || 0;
          const net = qty * price;
          const vat = net * (vatRate / 100);
          const total = net + vat;
          
          const productName = watched?.description || resolveProductName(watched?.productId);
          const isRrpOn = rrpEnabled[index] ?? defaultShowRrp;

          return (
            <div key={line.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {productName}
                    {watched?.plantVariety && watched.plantVariety !== productName && (
                      <span className="text-muted-foreground">({watched.plantVariety})</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Qty {qty} • VAT {vatRate}% • Line total {fc(total)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name={`lines.${index}.unitPrice`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Price</FormLabel>
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

                <FormField
                  control={form.control}
                  name={`lines.${index}.rrp`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pre-pricing (RRP)</FormLabel>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={isRrpOn}
                          onCheckedChange={(checked) => {
                            setRrpEnabled(prev => ({ ...prev, [index]: checked }));
                            if (!checked) {
                              field.onChange(null);
                            } else if (field.value == null) {
                              // Set a default RRP when enabling (e.g., unit price * 1.5 or just unit price)
                              field.onChange(price > 0 ? price : undefined);
                            }
                          }}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          disabled={!isRrpOn}
                          value={isRrpOn ? (field.value ?? '') : ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                          placeholder="Retail price"
                          className="flex-1"
                        />
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {/* Multibuy Pricing - Intuitive format */}
              <div className="pt-2 border-t">
                <FormLabel className="text-sm mb-2 block">Multibuy Offer</FormLabel>
                <div className="flex items-center gap-2 flex-wrap">
                  <FormField
                    control={form.control}
                    name={`lines.${index}.multibuyQty2`}
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="2"
                          className="w-16 text-center"
                          placeholder="3"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))}
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">for {sym}</span>
                      </div>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lines.${index}.multibuyPrice2`}
                    render={({ field }) => (
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24"
                        placeholder="10.00"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                      />
                    )}
                  />
                  {watched?.multibuyQty2 && watched?.multibuyPrice2 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (saves {fc((price * watched.multibuyQty2) - watched.multibuyPrice2)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delivery Selection */}
      {deliveryFees.length > 0 && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">Delivery</h3>
          </div>
          <Select value={selectedDeliveryFeeId} onValueChange={setSelectedDeliveryFeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select delivery option..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No delivery charge (Collection)</SelectItem>
              {deliveryFees.map((fee) => (
                <SelectItem key={fee.id} value={fee.id}>
                  {fee.name} - {fc(fee.amount)}
                  {fee.minOrderValue && ` (free over ${fc(fee.minOrderValue)})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {deliveryInfo.waived && (
            <p className="text-sm text-green-600">
              ✓ Free delivery - order exceeds {fc(deliveryInfo.minValue ?? 0)}
            </p>
          )}
        </div>
      )}

      {/* Order Summary */}
      <div className="border rounded-lg p-4 space-y-2">
        <h3 className="font-medium mb-3">Order Summary</h3>
        
        {/* Products */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Products</span>
          <span className="font-medium">{fc(grandTotal.productsNet)}</span>
        </div>
        
        {/* Pre-pricing fee */}
        {prePricingInfo.totalUnits > 0 && prePricingFee && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Tag className="h-3 w-3" />
              Pre-pricing
              {prePricingInfo.isFoc ? (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  FOC
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {prePricingInfo.totalUnits} × {fc(prePricingInfo.ratePerUnit)}
                </Badge>
              )}
            </span>
            {prePricingInfo.isFoc ? (
              <span className="font-medium text-green-600">FOC</span>
            ) : (
              <span className="font-medium">{fc(prePricingInfo.fee)}</span>
            )}
          </div>
        )}

        {/* Delivery fee */}
        {selectedDeliveryFeeId && selectedDeliveryFeeId !== '__none__' && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Truck className="h-3 w-3" />
              {deliveryInfo.name}
            </span>
            {deliveryInfo.waived ? (
              <span className="font-medium text-green-600">FREE</span>
            ) : (
              <span className="font-medium">{fc(deliveryInfo.fee)}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-sm pt-2 border-t">
          <span className="text-muted-foreground">Subtotal (excl. VAT)</span>
          <span className="font-medium">{fc(grandTotal.totalNet)}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">VAT</span>
          <span className="font-medium">{fc(grandTotal.totalVat)}</span>
        </div>

        <div className="flex items-center justify-between text-lg font-semibold pt-2 border-t">
          <span>Grand Total</span>
          <span>{fc(grandTotal.grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
