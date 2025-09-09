"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProductionAPI, PropagationInput } from "@/lib/production/client";
import { HttpError } from "@/lib/http/fetchJson";
import { useLookup } from "@/hooks/useLookup";
import { useActiveOrg } from "@/lib/org/context"; // Assuming you have this context for orgId

// Ensure these imports match your UI kit (shadcn)
import { Button } from "@/components/ui/button";
import {
  Form, FormField, FormItem, FormLabel, FormMessage, FormControl
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const Schema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  containers: z.coerce.number().int().min(1),
  planted_at: DateOnly.optional(),
  notes: z.string().max(1000).optional(),
});

type Variety = { id: string; name: string; category?: string | null };
type Size = { id: string; name: string; cell_multiple?: number | null };
type Location = { id: string; name: string; covered?: boolean | null };

export default function PropagationForm(props: {
  defaultLocationId?: string;
  onCreated?: (batch: any) => void;
}) {
  const { toast } = useToast?.() ?? { toast: (v: any) => alert(v?.title || v?.description || "OK") };
  const form = useForm<PropagationInput>({ resolver: zodResolver(Schema) });
  const { orgId } = useActiveOrg();

  const [loading, setLoading] = React.useState(false);
  
  const { options: varieties, isLoading: varietiesLoading, error: varietiesError } = useLookup("varieties", null); // varieties are global
  const { options: sizes, isLoading: sizesLoading, error: sizesError } = useLookup("sizes", null); // sizes are global
  const { options: locations, isLoading: locationsLoading, error: locationsError } = useLookup("locations", orgId); // locations are org-scoped

  // Set default location if provided
  React.useEffect(() => {
    if (props.defaultLocationId && locations.length > 0) {
      form.setValue("location_id", props.defaultLocationId as any);
    }
  }, [props.defaultLocationId, locations, form]);

  // Handle lookup errors
  React.useEffect(() => {
    if (varietiesError) toast({ title: "Failed to load varieties", description: varietiesError.message, variant: "destructive" });
    if (sizesError) toast({ title: "Failed to load sizes", description: sizesError.message, variant: "destructive" });
    if (locationsError) toast({ title: "Failed to load locations", description: locationsError.message, variant: "destructive" });
  }, [varietiesError, sizesError, locationsError, toast]);

  async function onSubmit(values: PropagationInput) {
    setLoading(true);
    try {
      const { batch, requestId } = await ProductionAPI.propagate(values);
      toast({ title: "Propagation created", description: `Batch ${batch.batch_number} created` });
      form.reset();
      props.onCreated?.(batch);
    } catch (err) {
      const e = err as HttpError;
      console.error("[PropagationForm] submit error", e);
      toast({
        title: e.status === 401 ? "Please sign in" : "Failed to create batch",
        description: e.requestId ? `${e.message} (ref ${e.requestId})` : e.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  const isLookupsLoading = varietiesLoading || sizesLoading || locationsLoading;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="plant_variety_id" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Variety</FormLabel>
            <Select onValueChange={field.onChange} value={field.value} disabled={isLookupsLoading}>
              <SelectTrigger><SelectValue placeholder={isLookupsLoading ? "Loading varieties..." : "Select variety"} /></SelectTrigger>
              <SelectContent>
                {varieties.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}{v.category ? ` — ${v.category}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField name="size_id" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Size</FormLabel>
            <Select onValueChange={field.onChange} value={field.value} disabled={isLookupsLoading}>
              <SelectTrigger><SelectValue placeholder={isLookupsLoading ? "Loading sizes..." : "Select size"} /></SelectTrigger>
              <SelectContent>
                {sizes.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.cell_multiple ? ` (${s.cell_multiple}/tray)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField name="location_id" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Location</FormLabel>
            <Select onValueChange={field.onChange} value={field.value} disabled={isLookupsLoading}>
              <SelectTrigger><SelectValue placeholder={isLookupsLoading ? "Loading locations..." : "Select location"} /></SelectTrigger>
              <SelectContent>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}{l.covered ? " (covered)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField name="containers" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Containers</FormLabel>
            <FormControl>
              <Input type="number" min={1} step={1} {...field} disabled={isLookupsLoading} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField name="planted_at" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Planted date</FormLabel>
            <FormControl>
              <Input type="date" {...field} disabled={isLookupsLoading} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField name="notes" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl><Textarea rows={3} {...field} disabled={isLookupsLoading} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={loading || isLookupsLoading}>
            {loading ? "Saving…" : "Create propagation"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
