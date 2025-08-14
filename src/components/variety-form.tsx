
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { type Variety, VarietySchema } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { useEffect } from 'react';

type VarietyFormValues = z.infer<typeof VarietySchema>;

interface VarietyFormProps {
  variety: Variety | null;
  onSubmit: (data: VarietyFormValues) => void;
  onCancel: () => void;
}

export function VarietyForm({ variety, onSubmit, onCancel }: VarietyFormProps) {
  const isEditing = !!variety?.id;

  const form = useForm<VarietyFormValues>({
    resolver: zodResolver(VarietySchema),
    defaultValues: variety || {
        name: '',
        family: '',
        category: '',
        grouping: '',
        commonName: '',
        rating: '',
        salesPeriod: '',
        floweringPeriod: '',
        flowerColour: '',
        evergreen: '',
    },
  });

  useEffect(() => {
    form.reset(variety || {
        name: '',
        family: '',
        category: '',
        grouping: '',
        commonName: '',
        rating: '',
        salesPeriod: '',
        floweringPeriod: '',
        flowerColour: '',
        evergreen: '',
    });
  }, [variety, form]);

  const handleSubmit = (values: VarietyFormValues) => {
    onSubmit(values);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Variety' : 'Add New Variety'}</DialogTitle>
        <DialogDescription>
          {isEditing && variety ? `Editing the details for "${variety.name}".` : 'Add a new plant variety to your golden table.'}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <ScrollArea className="h-[60vh] pr-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Variety Name</FormLabel>
                          <FormControl><Input placeholder="e.g., 'Munstead'" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="commonName" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Common Name</FormLabel>
                          <FormControl><Input placeholder="e.g., 'English Lavender'" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="family" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Plant Family</FormLabel>
                          <FormControl><Input placeholder="e.g., 'Lavender'" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl><Input placeholder="e.g., 'Perennial'" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="grouping" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Grouping</FormLabel>
                          <FormControl><Input placeholder="e.g., 'Herb'" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                   <FormField control={form.control} name="evergreen" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Evergreen</FormLabel>
                          <FormControl><Input placeholder="e.g., 'Yes' or 'No'" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="flowerColour" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Flower Colour</FormLabel>
                          <FormControl><Input placeholder="e.g., 'Purple'" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="floweringPeriod" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Flowering Period</FormLabel>
                          <FormControl><Input placeholder="e.g., 'Summer'" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="salesPeriod" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Sales Period</FormLabel>
                          <FormControl><Input placeholder="e.g., 'Spring-Summer'" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                   <FormField control={form.control} name="rating" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Rating</FormLabel>
                          <FormControl><Input placeholder="e.g., '5'" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Save Changes' : 'Add Variety'}</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
