
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useActiveOrg } from '@/lib/org/context';
import { AsyncCombobox } from "@/components/common/AsyncCombobox";
import React from 'react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const Schema = z.object({
  plant_variety_id: z.string().min(1),
  size_id: z.string().min(1),
  location_id: z.string().min(1),
  containers: z.coerce.number().int().min(0),
  planted_at: z.string().min(1),
});

export default function PropagationForm({ orgId }: { orgId?: string }) {
  const { orgId: activeOrgId } = useActiveOrg();
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: { 
      plant_variety_id: '', 
      size_id: '', 
      location_id: '', 
      containers: 0, 
      planted_at: new Date().toISOString().slice(0,10) 
    },
  });

  const onSubmit = async (values: z.infer<typeof Schema>) => {
    try {
      await fetchWithAuth('/api/batches/propagation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      // TODO: Add success toast
    } catch (error) {
      // TODO: Add error toast
      console.error(error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <AsyncCombobox
          name="plant_variety_id"
          control={form.control}
          resource="varieties"
          placeholder="Search variety"
          fetcher={fetchWithAuth}
        />
        <AsyncCombobox
          name="size_id"
          control={form.control}
          resource="sizes"
          placeholder="Select tray size"
          fetcher={fetchWithAuth}
        />
        <AsyncCombobox
          name="location_id"
          control={form.control}
          resource="locations"
          placeholder="Search location"
          fetcher={fetchWithAuth}
        />

        <FormField control={form.control} name="containers" render={({ field }) => (
          <FormItem>
            <FormLabel>Trays</FormLabel>
            <FormControl>
              <Input type="number" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="planted_at" render={({ field }) => (
          <FormItem>
            <FormLabel>Planted Date</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="pt-2">
          <Button type="submit">Create Propagation Batch</Button>
        </div>
      </form>
    </Form>
  );
}
