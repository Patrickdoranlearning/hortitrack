'use client';

import { FieldArrayWithId, UseFormReturn, useWatch } from 'react-hook-form';
import type { CreateOrderInput } from '@/lib/sales/types';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

type Props = {
  form: UseFormReturn<CreateOrderInput>;
  totals: { net: number; vat: number; total: number };
  lines: FieldArrayWithId<CreateOrderInput, 'lines', 'id'>[];
  onSubmit: () => void;
  isSubmitting: boolean;
};

export function PricingReviewStep({ form, totals, lines, onSubmit, isSubmitting }: Props) {
  const watchedLines = useWatch({ control: form.control, name: 'lines' });

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

          return (
            <div key={line.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {watched?.description || watched?.plantVariety || watched?.productId || 'Product line'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Qty {qty} • VAT {vatRate}% • Line total €{total.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                  render={({ field }) => {
                    const enabled = field.value != null;
                    return (
                      <FormItem>
                        <FormLabel>Pre-pricing (RRP)</FormLabel>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={enabled}
                            onCheckedChange={(checked) => field.onChange(checked ? field.value ?? price : undefined)}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            disabled={!enabled}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                            placeholder="Retail price on pot"
                          />
                        </div>
                      </FormItem>
                    );
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Net</span>
          <span className="font-medium">€{totals.net.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">VAT</span>
          <span className="font-medium">€{totals.vat.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Total</span>
          <span>€{(totals.net + totals.vat).toFixed(2)}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Creating Order...' : 'Create Order'}
        </Button>
      </div>
    </div>
  );
}
