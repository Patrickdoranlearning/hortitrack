
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
import { SupplierSchema as FormSchema, type Supplier } from '@/lib/types';
import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SupplierFormSchema = FormSchema.omit({ id: true });
type SupplierFormValues = Omit<Supplier, 'id'>;

interface SupplierFormProps {
  supplier: Supplier | null;
  onSubmit: (data: Omit<Supplier, 'id'> | Supplier) => void;
  onCancel: () => void;
}

export function SupplierForm({ supplier, onSubmit, onCancel }: SupplierFormProps) {
  const isEditing = !!supplier;

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(SupplierFormSchema),
    defaultValues: supplier
      ? { ...supplier }
      : {
          name: '',
          address: '',
          countryCode: 'IE',
          producerCode: '',
          phone: '',
          email: '',
          eircode: '',
          supplierType: '',
        },
  });

  useEffect(() => {
    form.reset(
      supplier || {
        name: '',
        address: '',
        countryCode: 'IE',
        producerCode: '',
        phone: '',
        email: '',
        eircode: '',
        supplierType: '',
      }
    );
  }, [supplier, form]);

  const handleFormSubmit = (data: SupplierFormValues) => {
    if (isEditing && supplier) {
      onSubmit({ ...data, id: supplier.id });
    } else {
      onSubmit(data);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
        <DialogDescription>
          {isEditing && supplier ? `Editing the details for "${supplier.name}".` : 'Add a new supplier to your master list.'}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Supplier Name</FormLabel>
                      <FormControl><Input placeholder="e.g., 'Greenfield Nursery'" {...field} /></FormControl>
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
              <FormField control={form.control} name="countryCode" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Country code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., IE"
                          value={field.value ?? ''}
                          maxLength={2}
                          onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="producerCode" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Producer code</FormLabel>
                      <FormControl><Input placeholder="e.g., '12345'" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="supplierType" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Supplier type</FormLabel>
                      <Select value={field.value || 'unspecified'} onValueChange={(val) => field.onChange(val === 'unspecified' ? '' : val)}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unspecified">Unspecified</SelectItem>
                          <SelectItem value="plant">Plant supplier</SelectItem>
                          <SelectItem value="general">General supplier</SelectItem>
                          <SelectItem value="hardware">Hardware supplier</SelectItem>
                          <SelectItem value="haulier">Haulier</SelectItem>
                          <SelectItem value="administrative">Administrative supplier</SelectItem>
                          <SelectItem value="stationary">Stationary supplier</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input placeholder="+353..." {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="supplier@example.com" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="eircode" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Eircode</FormLabel>
                      <FormControl><Input placeholder="Optional" {...field} /></FormControl>
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
