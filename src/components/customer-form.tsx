'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CustomerSchema, type Customer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import * as z from 'zod';

const CustomerFormSchema = CustomerSchema.omit({ id: true, orgId: true });
type CustomerFormValues = z.infer<typeof CustomerFormSchema>;

interface CustomerFormProps {
  customer: Customer | null;
  onSubmit: (data: Omit<Customer, 'id'> | Customer) => void;
  onCancel: () => void;
  saving?: boolean;
}

const defaultValues: CustomerFormValues = {
  code: '',
  name: '',
  email: '',
  phone: '',
  vatNumber: '',
  notes: '',
  defaultPriceListId: '',
  store: '',
  accountsEmail: '',
  pricingTier: '',
};

export function CustomerForm({ customer, onSubmit, onCancel, saving }: CustomerFormProps) {
  const isEditing = !!customer;

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(CustomerFormSchema),
    defaultValues: customer ? { ...customer } : defaultValues,
  });

  useEffect(() => {
    form.reset(customer ? { ...customer } : defaultValues);
  }, [customer, form]);

  const handleSubmit = (values: CustomerFormValues) => {
    if (isEditing && customer) {
      onSubmit({ ...values, id: customer.id });
    } else {
      onSubmit(values);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit customer' : 'Add customer'}</DialogTitle>
        <DialogDescription>
          {isEditing && customer ? `Update details for "${customer.name}".` : 'Add a new customer to the directory.'}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input placeholder="Customer name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="code" render={({ field }) => (
              <FormItem>
                <FormLabel>Customer code</FormLabel>
                <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="store" render={({ field }) => (
              <FormItem>
                <FormLabel>Store / chain</FormLabel>
                <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="pricingTier" render={({ field }) => (
              <FormItem>
                <FormLabel>Pricing tier</FormLabel>
                  <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                  <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Sales email</FormLabel>
                <FormControl><Input type="email" placeholder="orders@example.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="accountsEmail" render={({ field }) => (
              <FormItem>
                <FormLabel>Accounts email</FormLabel>
                <FormControl><Input type="email" placeholder="accounts@example.com" value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value)} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="vatNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>VAT number</FormLabel>
                <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl><Textarea placeholder="Internal notes" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Save changes' : 'Add customer'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
