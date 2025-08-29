
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useActiveOrg } from '@/lib/org/context';
import AsyncCombobox from '@/components/ui/AsyncCombobox';
import React from 'react';

const Schema = z.object({
  variety_id: z.string().min(1),
  size_id: z.string().min(1),
  site_id: z.string().uuid({ message: "Nursery is required." }), // Added site_id
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
      site_id: "" as any, // Added default value for site_id
      location_id: '', 
      trays: 0, 
      planted_at: new Date().toISOString().slice(0,10) 
    },
  });

  const [variety, setVariety] = React.useState<{ value: string; label: string; hint?: string } | null>(null);
  const [size, setSize] = React.useState<{ value: string; label: string; meta?: any } | null>(null);
  const [location, setLocation] = React.useState<{ value: string; label: string } | null>(null);

  const siteId = form.watch("site_id"); // Watch for changes in site_id
  React.useEffect(() => {
    // when nursery changes, clear location selection
    form.setValue("location_id", "" as any);
  }, [siteId, form]); 

  return (
    <Form {...form}>
      <form className="space-y-4">
        <FormField
            name="variety_id"
            control={form.control}
            render={({field}) => (
                <FormItem>
                    <FormLabel>Variety</FormLabel>
                    <AsyncCombobox
                        value={variety?.value ?? null}
                        onChange={(opt) => { setVariety(opt ? {value: opt, label: opt} : null); field.onChange(opt); }}
                        endpoint="/api/options/varieties"
                        placeholder="Search variety..."
                    />
                    <FormMessage />
                </FormItem>
            )}
        />
         <FormField
            name="size_id"
            control={form.control}
            render={({field}) => (
                <FormItem>
                    <FormLabel>Tray Size</FormLabel>
                    <AsyncCombobox
                        value={size?.value ?? null}
                        onChange={(opt) => { setSize(opt ? {value: opt, label: opt} : null); field.onChange(opt); }}
                        endpoint="/api/options/sizes"
                        placeholder="Select tray size"
                    />
                    <FormMessage />
                </FormItem>
            )}
        />

        {/* Nursery (Site) */}
        <FormField
          control={form.control}
          name="site_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nursery</FormLabel>
              <FormControl>
                <AsyncCombobox
                  endpoint="/api/options/sites"
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v)}
                  placeholder="Select nursery"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

         {/* Location */}
         <FormField
            name="location_id"
            control={form.control}
            render={({field}) => (
                <FormItem>
                    <FormLabel>Location</FormLabel>
                    <AsyncCombobox
                        value={location?.value ?? null}
                        onChange={(opt) => { setLocation(opt ? {value: opt, label: opt} : null); field.onChange(opt); }}
                        endpoint={`/api/options/locations${siteId ? `?site_id=${siteId}` : ""}`}
                        placeholder={siteId ? "Search locations" : "Select nursery first"}
                        disabled={!siteId}
                    />
                    <FormMessage />
                </FormItem>
            )}
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
