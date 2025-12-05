'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateOrderSchema, CreateOrderInput } from '@/lib/sales/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createOrder } from '@/app/sales/actions';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ProductBatchSelector, Product } from './ProductBatchSelector';

interface EnhancedCreateOrderFormProps {
  customers: { id: string; name: string; store?: string | null }[];
  products: Product[];
}

type Totals = { net: number; vat: number; total: number };

export default function EnhancedCreateOrderForm({ customers, products }: EnhancedCreateOrderFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderMode, setOrderMode] = useState<'basic' | 'specific'>('basic');
  const [showAllProducts, setShowAllProducts] = useState(false);

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(CreateOrderSchema),
    defaultValues: {
      customerId: '',
      storeId: 'main',
      deliveryAddress: '',
      orderReference: '',
      deliveryDate: '',
      shipMethod: '',
      notesCustomer: '',
      notesInternal: '',
      lines: [{
        plantVariety: '',
        size: '',
        qty: 1,
        allowSubstitute: true,
        unitPrice: undefined,
        vatRate: undefined,
        description: '',
      }],
      autoPrint: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const selectedCustomerId = form.watch('customerId');
  const storeId = form.watch('storeId');
  const lines = form.watch('lines');

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const storeLabel = selectedCustomer?.store || 'Main premises';

  useEffect(() => {
    // Reset store and custom address when customer changes
    if (selectedCustomer?.store) {
      form.setValue('storeId', selectedCustomer.store);
    } else {
      form.setValue('storeId', 'main');
    }
    form.setValue('deliveryAddress', '');
    setShowAllProducts(false);
  }, [selectedCustomer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProducts = useMemo(() => {
    if (!selectedCustomerId) {
      return products;
    }

    const aliasMatches = products.filter((product) =>
      product.aliases?.some(
        (alias) => alias.isActive !== false && alias.customerId === selectedCustomerId
      )
    );

    if (showAllProducts) {
      const aliasIds = new Set(aliasMatches.map((p) => p.id));
      return [
        ...aliasMatches,
        ...products.filter((p) => !aliasIds.has(p.id)),
      ];
    }

    // Default to alias matches, but fall back to all products so we never block the user
    return aliasMatches.length > 0 ? aliasMatches : products;
  }, [products, selectedCustomerId, showAllProducts]);

  const totals: Totals = useMemo(() => {
    const aggregate = (lines || []).reduce(
      (acc, line) => {
        const qty = line?.qty ? Number(line.qty) : 0;
        const price = line?.unitPrice ?? 0;
        const vatRate = line?.vatRate ?? 0;
        const net = qty * price;
        const vat = net * (vatRate / 100);
        acc.net += net;
        acc.vat += vat;
        return acc;
      },
      { net: 0, vat: 0, total: 0 } as Totals
    );

    return { ...aggregate, total: aggregate.net + aggregate.vat };
  }, [lines]);

  async function onSubmit(data: CreateOrderInput) {
    setIsSubmitting(true);
    try {
      const result = await createOrder(data);
      if (result?.error) {
        console.error(result.error);
        // TODO: Show error toast
      } else {
        // Success - redirect handled by createOrder
        form.reset();
      }
    } catch (error) {
      console.error('Failed to create order', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
              <CardDescription>Customer, delivery, and reference details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer *</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value)}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Search for a customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="storeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store / Delivery To</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || 'main'}
                        disabled={!selectedCustomer}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedCustomer ? 'Select store or custom address' : 'Select a customer first'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={selectedCustomer?.store || 'main'}>
                            {storeLabel}
                          </SelectItem>
                          <SelectItem value="custom">Custom delivery address</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="deliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requested Delivery Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shipMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipping Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select shipping method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="van">Van Delivery</SelectItem>
                          <SelectItem value="haulier">Haulier</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="orderReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. PO number or reference" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {storeId === 'custom' && (
                <FormField
                  control={form.control}
                  name="deliveryAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Delivery Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter delivery address for this order"
                          className="resize-none"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="notesCustomer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Notes visible to customer on invoice..."
                          className="resize-none"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notesInternal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Internal notes (not visible to customer)..."
                          className="resize-none"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="autoPrint"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Auto Print Documents</FormLabel>
                      <FormDescription className="text-xs">
                        Automatically print pick list and invoice
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Order Items
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Add lines, pick optional batches, and see totals update automatically.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={showAllProducts}
                      onCheckedChange={(checked) => setShowAllProducts(checked)}
                    />
                    <span>Show all products (not just aliases)</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Batch preference</p>
                  <p className="text-xs text-muted-foreground">
                    Basic auto-allocates; Specific lets you pick batches or grade preferences.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={orderMode === 'basic' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOrderMode('basic')}
                  >
                    Basic
                  </Button>
                  <Button
                    type="button"
                    variant={orderMode === 'specific' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOrderMode('specific')}
                  >
                    Specific
                  </Button>
                </div>
              </div>

              <div className="hidden md:grid grid-cols-12 gap-3 text-xs font-semibold text-muted-foreground px-2">
                <div className="col-span-5">Product / Batch</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Unit Price</div>
                <div className="col-span-2">VAT %</div>
                <div className="col-span-1 text-right">Line Total</div>
              </div>

              {fields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No items added yet. Click "Add Item" to start building the order.</p>
                </div>
              )}

              {fields.map((field, index) => {
                const line = lines?.[index];
                const qty = line?.qty ? Number(line.qty) : 0;
                const price = line?.unitPrice ?? 0;
                const vatRate = line?.vatRate ?? 0;
                const lineNet = qty * price;
                const lineVat = lineNet * (vatRate / 100);
                const lineTotal = lineNet + lineVat;

                return (
                  <Card key={field.id} className="shadow-sm">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Item {index + 1}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-12 gap-4 items-start">
                        <div className="col-span-12 space-y-3">
                          <FormField
                            control={form.control}
                            name={`lines.${index}`}
                            render={({ field }) => (
                              <FormItem>
                                <ProductBatchSelector
                                  products={filteredProducts}
                                  customerId={selectedCustomerId}
                                  value={field.value}
                                  onChange={(newValue) => {
                                    field.onChange({
                                      ...field.value,
                                      ...newValue,
                                    });
                                  }}
                                  mode={orderMode}
                                  className="w-full"
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`lines.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Description (optional)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Custom description for this line"
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`lines.${index}.allowSubstitute`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center gap-2">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <FormLabel className="text-xs !mt-0">Allow substitute if out of stock</FormLabel>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-6 md:col-span-2">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.qty`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Qty *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="1"
                                    {...field}
                                    onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-6 md:col-span-2">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.unitPrice`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Unit Price (€)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Auto"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={e => {
                                      const value = e.target.value;
                                      field.onChange(value === '' ? undefined : parseFloat(value));
                                    }}
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Leave empty for price list price
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-6 md:col-span-2">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.vatRate`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">VAT Rate (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.5"
                                    placeholder="13.5"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={e => {
                                      const value = e.target.value;
                                      field.onChange(value === '' ? undefined : parseFloat(value));
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-6 md:col-span-1 text-right">
                          <div className="text-xs text-muted-foreground">Line Total</div>
                          <div className="font-semibold">€{lineTotal.toFixed(2)}</div>
                          <div className="text-[11px] text-muted-foreground">Net €{lineNet.toFixed(2)} · VAT €{lineVat.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => append({
                            plantVariety: '',
                            size: '',
                            qty: 1,
                            allowSubstitute: true,
                            unitPrice: undefined,
                            vatRate: undefined,
                          })}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <Button type="button" variant="outline" onClick={() => form.reset()}>
              Reset Form
            </Button>

            <div className="w-full md:w-80 space-y-3">
              <div className="rounded-lg border p-4 space-y-2 bg-muted/40">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Net</span>
                  <span className="font-medium">€{totals.net.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">VAT</span>
                  <span className="font-medium">€{totals.vat.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>€{totals.total.toFixed(2)}</span>
                </div>
              </div>
              <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
                {isSubmitting ? 'Creating Order...' : 'Create Order'}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
