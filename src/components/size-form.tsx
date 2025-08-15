
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
import type { PlantSize } from '@/lib/types';
import { PlantSizeSchema as FormSchema } from '@/lib/types'; // Rename to avoid conflict
import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const PlantSizeFormSchema = FormSchema.omit({ id: true }); // Omit ID for form validation
type SizeFormValues = Omit<PlantSize, 'id'>;

interface SizeFormProps {
  size: PlantSize | null;
  onSubmit: (data: Omit<PlantSize, 'id'> | PlantSize) => void;
  onCancel: () => void;
}

export function SizeForm({ size, onSubmit, onCancel }: SizeFormProps) {
  const isEditing = !!size;

  const form = useForm<SizeFormValues>({
    resolver: zodResolver(PlantSizeFormSchema),
    defaultValues: size ? { ...size } : {
        size: '',
        type: 'Pot',
        area: 0,
        shelfQuantity: 0,
        multiple: 1,
    },
  });

  useEffect(() => {
    form.reset(size || {
        size: '',
        type: 'Pot',
        area: 0,
        shelfQuantity: 0,
        multiple: 1,
    });
  }, [size, form]);
  
  const handleFormSubmit = (data: SizeFormValues) => {
    if (isEditing && size) {
      onSubmit({ ...data, id: size.id });
    } else {
      onSubmit(data);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4" noValidate aria-busy={form.formState.isSubmitting}>
            <FormField control={form.control} name="size" render={({ field }) => (
                <FormItem>
                    <FormLabel>Size Name</FormLabel>
                    <FormControl><Input placeholder="e.g., P9 or 54" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                    <FormLabel>Type</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value ?? "Pot"}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Pot">Pot</SelectItem>
                        <SelectItem value="Tray">Tray</SelectItem>
                        <SelectItem value="Bareroot">Bareroot</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="area" render={({ field }) => (
                <FormItem>
                    <FormLabel>Area (m²)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 0.01"
                        {...field}
                        onChange={(e) => { const v = e.target.value; field.onChange(v === "" ? undefined : parseFloat(v)); }}
                      />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="shelfQuantity" render={({ field }) => (
                <FormItem>
                    <FormLabel>Shelf Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 100"
                        {...field}
                        onChange={(e) => { const v = e.target.value; field.onChange(v === "" ? undefined : parseInt(v, 10)); }}
                      />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="multiple" render={({ field }) => (
                <FormItem>
                    <FormLabel>Multiple (for Trays)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 54"
                        {...field}
                        onChange={(e) => { const v = e.target.value; field.onChange(v === "" ? undefined : parseInt(v, 10)); }}
                      />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            
          <DialogFooter className="pt-6">
            {onCancel && (<Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>)}\
            <Button\
              type="submit"\
              disabled={form.formState.isSubmitting}\
              aria-disabled={form.formState.isSubmitting}\
            >\
              {form.formState.isSubmitting ? (isEditing ? 'Saving Changes…' : 'Adding Size…') : (isEditing ? 'Save Changes' : 'Add Size')}\
            </Button>\
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
