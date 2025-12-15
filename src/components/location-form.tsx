'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { NurseryLocationSchema, type NurseryLocation } from '@/lib/types';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const LocationFormSchema = NurseryLocationSchema.omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, 'Name is required'),
  nurserySite: z.string().min(1, 'Nursery site is required'),
  type: z.string().min(1, 'Type is required'),
  area: z.number().nonnegative().optional(),
});

type LocationFormValues = z.infer<typeof LocationFormSchema>;

interface LocationFormProps {
  location: NurseryLocation | null;
  onSubmit: (data: Omit<NurseryLocation, 'id'> | NurseryLocation) => void;
  onCancel: () => void;
}

const defaultValues: LocationFormValues = {
  name: '',
  nurserySite: '',
  type: '',
  covered: false,
  area: undefined,
  siteId: undefined,
};

export function LocationForm({ location, onSubmit, onCancel }: LocationFormProps) {
  const isEditing = !!location;

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(LocationFormSchema),
    defaultValues: location
      ? {
          name: location.name ?? '',
          nurserySite: location.nurserySite ?? '',
          type: location.type ?? '',
          covered: location.covered ?? false,
          area: location.area,
          siteId: location.siteId,
        }
      : defaultValues,
  });

  useEffect(() => {
    form.reset(
      location
        ? {
            name: location.name ?? '',
            nurserySite: location.nurserySite ?? '',
            type: location.type ?? '',
            covered: location.covered ?? false,
            area: location.area,
            siteId: location.siteId,
          }
        : defaultValues
    );
  }, [location, form]);

  const handleSubmit = (values: LocationFormValues) => {
    if (isEditing && location) {
      onSubmit({ ...values, id: location.id });
    } else {
      onSubmit(values);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Location' : 'Add Location'}</DialogTitle>
        <DialogDescription>
          {isEditing && location
            ? `Update details for "${location.name}".`
            : 'Add a new nursery location to your master list.'}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Tunnel 12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nurserySite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nursery site</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Main" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Structure type</FormLabel>
                    <FormControl>
                      <Input placeholder="Tunnel, Glasshouse, Section…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="siteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site ID (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="External reference" value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value || undefined)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area (m²)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Optional"
                        value={field.value ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          field.onChange(value === '' ? undefined : Number(value));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="covered"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Covered</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2 rounded-lg border p-3">
                        <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                        <Label>{field.value ? 'Covered' : 'Outdoor / uncovered'}</Label>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </ScrollArea>
          <DialogFooter className="pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Save changes' : 'Add location'}</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
