"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProductionAPI } from "@/lib/production/client";
import { HttpError } from "@/lib/http/fetchJson";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { LocationComboboxGrouped, type LocationData } from "@/components/ui/location-combobox-grouped";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";

const Schema = z.object({
  location_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export default function MoveForm({ batchId, onDone }: { batchId: string; onDone?: () => void }) {
  const form = useForm<z.infer<typeof Schema>>({ resolver: zodResolver(Schema) });
  const [locations, setLocations] = React.useState<LocationData[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/lookups/locations")
      .then(r => r.json())
      .then(j => setLocations((j.data || []).map((l: any) => ({
        id: l.id, name: l.name, nursery_site: l.nursery_site ?? "", is_virtual: l.is_virtual ?? false,
      }))));
  }, []);

  async function onSubmit(values: z.infer<typeof Schema>) {
    setLoading(true);
    try {
      await ProductionAPI.move(batchId, values);
      toast.success("Batch location updated.");
      onDone?.();
    } catch (e) {
      const er = e as HttpError;
      toast.error(er.message);
    } finally { setLoading(false); }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="location_id" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>New location</FormLabel>
            <LocationComboboxGrouped
              locations={locations}
              value={field.value}
              onSelect={field.onChange}
              createHref="/locations"
              placeholder="Select location"
              excludeVirtual
            />
            <FormMessage />
          </FormItem>
        )} />
        <FormField name="notes" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl><Textarea rows={3} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex justify-end"><Button type="submit" disabled={loading}>{loading ? "Moving…" : "Move"}</Button></div>
      </form>
    </Form>
  );
}
