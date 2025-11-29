'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HaulierSchema, type Haulier } from '@/lib/types';
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
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const HaulierFormSchema = HaulierSchema.omit({ id: true, orgId: true });
type HaulierFormValues = Omit<Haulier, 'id' | 'orgId'>;

interface HaulierFormProps {
  haulier: Haulier | null;
  onSubmit: (data: Omit<Haulier, 'id'> | Haulier) => void;
  onCancel: () => void;
}

const defaultValues: HaulierFormValues = {
  name: '',
  phone: '',
  email: '',
  notes: '',
  isActive: true,
};

export function HaulierForm({ haulier, onSubmit, onCancel }: HaulierFormProps) {
  const isEditing = !!haulier;

  const form = useForm<HaulierFormValues>({
    resolver: zodResolver(HaulierFormSchema),
    defaultValues: haulier ? { ...haulier } : defaultValues,
  });

  useEffect(() => {
    form.reset(haulier ? { ...haulier } : defaultValues);
  }, [haulier, form]);

  const handleSubmit = (values: HaulierFormValues) => {
    if (isEditing && haulier) {
      onSubmit({ ...values, id: haulier.id });
    } else {
      onSubmit(values);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit haulier' : 'Add haulier'}</DialogTitle>
        <DialogDescription>
          {isEditing && haulier ? `Update details for "${haulier.name}".` : 'Add a new logistics partner.'}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input placeholder="Haulier name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl><Input placeholder="Contact phone" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" placeholder="logistics@example.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="isActive" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    <Label>{field.value ? 'Active' : 'Inactive'}</Label>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl><Input placeholder="Optional notes" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Save changes' : 'Add haulier'}</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
