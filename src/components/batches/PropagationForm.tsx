
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

const Schema = z.object({
  variety_id: z.string().min(1),
  size_id: z.string().min(1),
  nursery_site: z.string().min(1, "Nursery is required."), // Changed to nursery_site (string)
  location_id: z.string().min(1),
  trays: z.coerce.number().int().min(0),
  planted_at: z.string().min(1),
});

const VARIETY_SELECT = "id,name,family,genus,species";
const SIZE_SELECT = "id,name,container_type,multiple:cell_multiple";
const LOCATION_SELECT = "id,name";

export default function PropagationForm({ orgId }: { orgId?: string }) {
  const { orgId: activeOrgId } = useActiveOrg();
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: { 
      variety_id: '', 
      size_id: '', 
      nursery_site: "", // Changed default value for nursery_site
      location_id: '', 
      trays: 0, 
      planted_at: new Date().toISOString().slice(0,10) 
    },
  });

  const [variety, setVariety] = React.useState<{ value: string; label: string; hint?: string } | null>(null);
  const [size, setSize] = React.useState<{ value: string; label: string; meta?: any } | null>(null);
  const [location, setLocation] = React.useState<{ value: string; label: string } | null>(null);

  const nurserySite = form.watch("nursery_site"); // Watch for changes in nursery_site
  React.useEffect(() => {
    // when nursery changes, clear location selection
    form.setValue("location_id", "" as any);
  }, [nurserySite, form]); 

  return (
    <Form {...form}>
      <form className="space-y-4">
        <AsyncCombobox
          name="plant_variety_id"
          control={form.control}
          resource="varieties"
          placeholder="Search variety"
        />
        <AsyncCombobox
          name="size_id"
          control={form.control}
          resource="sizes"
          placeholder="Select tray size"
        />
        <AsyncCombobox
          name="site_id"
          control={form.control}
          resource="sites"
          placeholder="Select nursery"
        />
        <AsyncCombobox
          name="location_id"
          control={form.control}
          resource="locations"
          params={() => ({ siteId: form.getValues("site_id") })}
          placeholder="Search location"
        />

        <FormField control={form.control} name="trays" render={({ field }) => (
          <FormItem>
            <FormLabel>Trays</FormLabel>
            <FormControl>
              <Input type="number" value={field.value ?? 0} onChange={(e) => field.onChange(e.target.value)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="planted_at" render={({ field }) => (
          <FormItem>
            <FormLabel>Planted Date</FormLabel>
            <FormControl>
              <Input type="date" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} />
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
