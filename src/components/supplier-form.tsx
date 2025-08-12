
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { SupplierSchema, type Supplier } from '@/lib/types';
import { useEffect } from 'react';

type SupplierFormValues = Supplier;

interface SupplierFormProps {
  supplier: Supplier | null;
  onSubmit: (data: Supplier) => void;
  onCancel: () => void;
}

export function SupplierForm({ supplier, onSubmit, onCancel }: SupplierFormProps) {
  const isEditing = !!supplier;

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(SupplierSchema),
    defaultValues: supplier || {
        id: '',
        name: '',
        address: '',
        country: '',
        countryCode: '',
        producerCode: '',
    },
  });

  useEffect(() => {
    form.reset(supplier || {
        id: '',
        name: '',
        address: '',
        country: '',
        countryCode: '',
        producerCode: '',
    });
  }, [supplier, form]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
        <DialogDescription>
          {isEditing ? `Editing the details for "${supplier.name}".` : 'Add a new supplier to your master list.'}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Supplier Name</FormLabel>
                      <FormControl><Input placeholder="e.g., 'Doran Nurseries'" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl><Input placeholder="e.g., 'Timahoe, Donadea, Naas'" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="country" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl><Input placeholder="e.g., 'Ireland'" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="countryCode" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Country Code (D)</FormLabel>
                      <FormControl><Input placeholder="e.g., 'IE'" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="producerCode" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Producer Code (B)</FormLabel>
                      <FormControl><Input placeholder="e.g., '12345'" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
          </div>
            
          <DialogFooter className="pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Save Changes' : 'Add Supplier'}</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
