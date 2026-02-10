
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateOrderSchema, CreateOrderInput } from '@/lib/sales/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { SearchableSelect } from '../ui/searchable-select';
import { createOrder } from '@/app/sales/actions';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import { currencySymbol, type CurrencyCode } from '@/lib/format-currency';

interface CreateOrderFormProps {
    customers: { id: string; name: string }[];
    currency?: CurrencyCode;
}

export default function CreateOrderForm({ customers, currency = 'EUR' }: CreateOrderFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<CreateOrderInput>({
        resolver: zodResolver(CreateOrderSchema),
        defaultValues: {
            customerId: '',
            storeId: 'main', // Default store for now
            lines: [{ plantVariety: '', size: '', qty: 1 }],
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
                toast.error(result.error);
            } else {
                toast.success('Order created successfully');
                form.reset();
            }
        } catch (error) {
            toast.error('Failed to create order. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="customerId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Customer</FormLabel>
                                <SearchableSelect
                                    options={customers.map((customer) => ({
                                        value: customer.id,
                                        label: customer.name,
                                    }))}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    createHref="/sales/customers"
                                    placeholder="Select a customer"
                                    createLabel="Add new customer"
                                />
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

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">Order Items</h3>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append({ plantVariety: '', size: '', qty: 1, allowSubstitute: false })}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Item
                        </Button>
                    </div>

                    {fields.map((field, index) => (
                        <Card key={field.id}>
                            <CardContent className="p-4 grid grid-cols-12 gap-4 items-end">
                                <div className="col-span-4">
                                    <FormField
                                        control={form.control}
                                        name={`lines.${index}.plantVariety`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Product / Variety</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Lavandula" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="col-span-3">
                                    <FormField
                                        control={form.control}
                                        name={`lines.${index}.size`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Size</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. 2L Pot" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <FormField
                                        control={form.control}
                                        name={`lines.${index}.qty`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Quantity</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        {...field}
                                                        onChange={e => field.onChange(parseInt(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <FormField
                                        control={form.control}
                                        name={`lines.${index}.unitPrice`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Price ({currencySymbol(currency)})</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
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
                                <div className="col-span-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => remove(index)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Creating...' : 'Create Order'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
