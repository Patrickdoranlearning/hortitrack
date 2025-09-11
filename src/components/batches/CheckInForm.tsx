"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProductionAPI, CheckInInput } from "@/lib/production/client";
import { HttpError } from "@/lib/http/fetchJson";
import { useLookup } from "@/hooks/useLookup";
import { useActiveOrg } from "@/lib/org/context"; // Assuming you have this context for orgId

import { Button } from "@/components/ui/button";
import {
  Form, FormField, FormItem, FormLabel, FormMessage, FormControl
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const Schema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  phase: z.enum(["propagation","plug","potted"]),
  supplier_id: z.string().uuid(),
  containers: z.coerce.number().int().min(1),
  supplier_batch_number: z.string().min(1).max(120),
  incoming_date: DateOnly,
  quality_rating: z.coerce.number().int().min(1).max(6).optional(),
  pest_or_disease: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  passport_override: z.object({
    operator_reg_no: z.string().optional(),
    origin_country: z.string().optional(),
    traceability_code: z.string().optional(),
  }).optional(),
});

type Variety = { id: string; name: string; category?: string | null };
type Size = { id: string; name: string; cell_multiple?: number | null; container_type?: string | null };
type Location = { id: string; name: string; covered?: boolean | null };
type Supplier = { id: string; name: string; producer_code?: string | null; country_code?: string | null };

export default function CheckInForm(props: { onCreated?: (batch: any) => void }) {
  const { toast } = useToast?.() ?? { toast: (v: any) => alert(v?.title || v?.description || "OK") };
  const form = useForm<CheckInInput>({ resolver: zodResolver(Schema) });
  const { orgId } = useActiveOrg();

  const [loading, setLoading] = React.useState(false);
  const [overrideOn, setOverrideOn] = React.useState(false);
  
  const { options: varieties, isLoading: varietiesLoading, error: varietiesError } = useLookup("varieties", null); // varieties are global
  const { options: sizes, isLoading: sizesLoading, error: sizesError } = useLookup("sizes", null); // sizes are global
  const { options: locations, isLoading: locationsLoading, error: locationsError } = useLookup("locations", orgId); // locations are org-scoped
  const { options: suppliers, isLoading: suppliersLoading, error: suppliersError } = useLookup("suppliers", orgId); // suppliers are org-scoped

  // Handle lookup errors
  React.useEffect(() => {
    if (varietiesError) toast({ title: "Failed to load varieties", description: varietiesError.message, variant: "destructive" });
    if (sizesError) toast({ title: "Failed to load sizes", description: sizesError.message, variant: "destructive" });
    if (locationsError) toast({ title: "Failed to load locations", description: locationsError.message, variant: "destructive" });
    if (suppliersError) toast({ title: "Failed to load suppliers", description: suppliersError.message, variant: "destructive" });
  }, [varietiesError, sizesError, locationsError, suppliersError, toast]);

  async function onSubmit(values: CheckInInput) {
    setLoading(true);
    try {
      const { batch } = await ProductionAPI.checkIn(values);
      toast({ title: "Batch checked in", description: `Batch ${batch.batch_number} created` });
      form.reset();
      props.onCreated?.(batch);
    } catch (err) {
      const e = err as HttpError;
      console.error("[CheckInForm] submit error", e);
      toast({
        title: e.status === 401 ? "Please sign in" : "Failed to check in",
        description: e.requestId ? `${e.message} (ref ${e.requestId})` : e.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  const isLookupsLoading = varietiesLoading || sizesLoading || locationsLoading || suppliersLoading;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="plant_variety_id" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Variety</FormLabel>
            <Select onValueChange={field.onChange} value={field.value} disabled={isLookupsLoading}>
              <SelectTrigger><SelectValue placeholder={isLookupsLoading ? "Loading varieties..." : "Select variety"} /></SelectTrigger>
              <SelectContent>{varieties.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}{v.category ? ` — ${v.category}` : ""}
                </SelectItem>
              ))}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField name="size_id" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Size</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isLookupsLoading}>
                <SelectTrigger><SelectValue placeholder={isLookupsLoading ? "Loading sizes..." : "Select size"} /></SelectTrigger>
                <SelectContent>{sizes.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.cell_multiple ? ` (${s.cell_multiple}/tray)` : ""}
                  </SelectItem>
                ))}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField name="phase" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Phase</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isLookupsLoading}>
                <SelectTrigger><SelectValue placeholder={isLookupsLoading ? "Loading phases..." : "Select phase"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="propagation">Propagation</SelectItem>
                  <SelectItem value="plug">Plug / Liner</SelectItem>
                  <SelectItem value="potted">Potted</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField name="location_id" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Location</FormLabel>
            <Select onValueChange={field.onChange} value={field.value} disabled={isLookupsLoading}>
              <SelectTrigger><SelectValue placeholder={isLookupsLoading ? "Loading locations..." : "Select location"} /></SelectTrigger>
              <SelectContent>{locations.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}{l.covered ? " (covered)" : ""}
                </SelectItem>
              ))}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField name="supplier_id" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Supplier</FormLabel>
            <Select onValueChange={field.onChange} value={field.value} disabled={isLookupsLoading}>
              <SelectTrigger><SelectValue placeholder={isLookupsLoading ? "Loading suppliers..." : "Select supplier"} /></SelectTrigger>
              <SelectContent>{suppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField name="containers" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Containers</FormLabel>
              <FormControl><Input type="number" min={1} step={1} {...field} disabled={isLookupsLoading} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="incoming_date" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Incoming date</FormLabel>
              <FormControl><Input type="date" {...field} disabled={isLookupsLoading} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="quality_rating" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Quality (1–6)</FormLabel>
              <FormControl><Input type="number" min={1} max={6} step={1} {...field} disabled={isLookupsLoading} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField name="supplier_batch_number" control={form.control} render={({ field }) => (
           <FormItem>
             <FormLabel>Supplier Batch No.</FormLabel>
             <FormControl><Input {...field} disabled={isLookupsLoading} /></FormControl>
             <FormMessage />
           </FormItem>
         )} />
 
        {/* Plant Passport Override */}
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Plant Passport Override</div>
            <div className="flex items-center gap-2 text-sm">
              <span>Use override</span>
              <input
                type="checkbox"
                checked={overrideOn}
                onChange={(e) => setOverrideOn(e.target.checked)}
                className="h-4 w-4"
                disabled={isLookupsLoading}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Defaults to the selected supplier’s producer code and country.
            Enable to override any of the fields below.
          </p>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${overrideOn ? "" : "opacity-50 pointer-events-none"}`}>
            <FormField
              name="passport_override.operator_reg_no"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operator Reg No.</FormLabel>
                  <FormControl><Input placeholder="e.g. IE2727" {...field} disabled={isLookupsLoading} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="passport_override.origin_country"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origin Country (ISO)</FormLabel>
                  <FormControl><Input placeholder="IE, NL, GB..." {...field} disabled={isLookupsLoading} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="passport_override.traceability_code"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Traceability Code</FormLabel>
                  <FormControl><Input placeholder="Overrides supplier batch no." {...field} disabled={isLookupsLoading} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <FormField name="pest_or_disease" control={form.control} render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} disabled={isLookupsLoading} />
              </FormControl>
              <FormLabel>Pest or disease present</FormLabel>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField name="notes" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl><Textarea rows={3} {...field} disabled={isLookupsLoading} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={loading || isLookupsLoading}>
            {loading ? "Saving…" : "Check in batch"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
