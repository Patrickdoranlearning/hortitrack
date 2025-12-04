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
import { useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ProductBatchSelector, Product, Batch } from './ProductBatchSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EnhancedCreateOrderFormProps {
  customers: { id: string; name: string }[];
  products: Product[];
}

export default function EnhancedCreateOrderForm({ customers, products }: EnhancedCreateOrderFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderMode, setOrderMode] = useState<'basic' | 'specific'>('basic');

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(CreateOrderSchema),
    defaultValues: {
      customerId: '',
      storeId: 'main',
      lines: [{
        plantVariety: '',
        size: '',
        qty: 1,
        allowSubstitute: false,
      }],
      autoPrint: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

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

  const selectedCustomer = customers.find(c => c.id === form.watch('customerId'));

  return (
    <div className="max-w-7xl mx-auto px-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Customer & Order Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
              <CardDescription>
                Customer details and delivery preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Customer & Delivery Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a customer" />
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
                  name="deliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requested Delivery Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </div>

              {/* Notes */}
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
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Order Items Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Order Items
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Add products to this order. Choose basic mode for automatic allocation or specific mode to select batches.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({
                    plantVariety: '',
                    size: '',
                    qty: 1,
                    allowSubstitute: false
                  })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order Mode Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Order Mode</p>
                  <p className="text-xs text-muted-foreground">
                    {orderMode === 'basic'
                      ? 'System will automatically allocate products from available inventory'
                      : 'Select specific batches, grades, or variety preferences'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={orderMode === 'basic' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOrderMode('basic')}
                  >
                    Basic Order
                  </Button>
                  <Button
                    type="button"
                    variant={orderMode === 'specific' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOrderMode('specific')}
                  >
                    Specific Order
                  </Button>
                </div>
              </div>

              {fields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No items added yet. Click "Add Item" to start building the order.</p>
                </div>
              )}

              {fields.map((field, index) => (
                <Card key={field.id} className="shadow-sm">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between mb-2">
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

                    <Separator />

                    {/* Product Selection */}
                    <FormField
                      control={form.control}
                      name={`lines.${index}`}
                      render={({ field }) => (
                        <FormItem>
                          <ProductBatchSelector
                            products={products}
                            value={field.value}
                            onChange={(newValue) => {
                              field.onChange({
                                ...field.value,
                                ...newValue,
                              });
                            }}
                            mode={orderMode}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    {/* Quantity, Price, and Options */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.qty`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Quantity *</FormLabel>
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

                      <FormField
                        control={form.control}
                        name={`lines.${index}.allowSubstitute`}
                        render={({ field }) => (
                          <FormItem className="flex flex-col justify-end">
                            <div className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-xs !mt-0">
                                Allow Substitute
                              </FormLabel>
                            </div>
                            <FormDescription className="text-xs">
                              If out of stock
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Description Override */}
                    <FormField
                      control={form.control}
                      name={`lines.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Description Override (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Custom description for this line item..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Submit Section */}
          <div className="flex justify-between items-center">
            <Button type="button" variant="outline" onClick={() => form.reset()}>
              Reset Form
            </Button>
            <Button type="submit" disabled={isSubmitting} size="lg">
              {isSubmitting ? 'Creating Order...' : 'Create Order'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
