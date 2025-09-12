"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProductionAPI } from "@/lib/production/client";
import { Button } from "@/components/ui/button";
import {
  Form, FormField, FormItem, FormLabel, FormMessage, FormControl
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const Schema = z.object({
  parent_batch_id: z.string().uuid(),
  size_id: z.string().uuid(),
  // NOTE: keep the original field name you had to avoid upstream prop breakage
  newLocationId: z.string().uuid(),
  containers: z.coerce.number().int().min(1),
  planted_at: DateOnly.optional(),
  notes: z.string().max(1000).optional(),
  archive_parent_if_empty: z.boolean().optional(),
});

type Size = { id: string; name: string; container_type?: string | null; cell_multiple?: number | null };
type Location = { id: string; name: string; covered?: boolean | null };

export default function TransplantForm(props: {
  parentBatchId: string;
  defaultTargetLocationId?: string;
  onCreated?: (child: { id: string; batch_number: string }) => void;
}) {
  const { add: toast } = useToast();
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      parent_batch_id: props.parentBatchId as any,
      archive_parent_if_empty: true,
    },
  });

  const [loading, setLoading] = React.useState(false);
  const [sizes, setSizes] = React.useState<Size[]>([]);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [parent, setParent] = React.useState<{ id: string; batch_number: string; quantity: number } | null>(null);

  const selectedSize = sizes.find(s => s.id === form.watch("size_id")) || null;
  const cellMultiple = selectedSize?.cell_multiple ?? 1;
  const containers = Number(form.watch("containers") || 0);
  const requiredUnits = containers * cellMultiple;
  const availableUnits = parent?.quantity ?? 0;
  const insufficient = requiredUnits > availableUnits;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sumRes, sizesRes, locsRes] = await Promise.all([
          fetch(`/api/production/batches/${props.parentBatchId}/summary`),
          fetch("/api/lookups/sizes"),
          fetch("/api/lookups/locations"),
        ]);
        if (!sumRes.ok) throw new Error(`Summary load failed: ${sumRes.status}`);
        if (!sizesRes.ok) throw new Error(`Sizes load failed: ${sizesRes.status}`);
        if (!locsRes.ok) throw new Error(`Locations load failed: ${locsRes.status}`);
        const [sum, s, l] = await Promise.all([sumRes.json(), sizesRes.json(), locsRes.json()]);
        if (cancelled) return;

        if (sum?.batch) {
          setParent({ id: sum.batch.id, batch_number: sum.batch.batch_number, quantity: sum.batch.quantity });
          form.setValue("parent_batch_id", sum.batch.id as any);
        } else {
          toast({ title: "Parent not found", variant: "destructive" });
        }

        setSizes(s.data ?? []);
        setLocations(l.data ?? []);
        if (props.defaultTargetLocationId) form.setValue("newLocationId", props.defaultTargetLocationId as any);
      } catch (e) {
        console.error("[TransplantForm] load failed", e);
        toast({ title: "Failed to load transplant data", description: String((e as any)?.message ?? e), variant: "destructive" });
      }
    })();
    return () => { cancelled = true; };
  }, [props.parentBatchId]); // eslint-disable-line

  async function onSubmit(values: z.infer<typeof Schema>) {
    setLoading(true);
    try {
      const payload = {
        parent_batch_id: values.parent_batch_id,
        size_id: values.size_id,
        location_id: values.newLocationId, // map old field name → API contract
        containers: values.containers,
        planted_at: values.planted_at,
        notes: values.notes,
        archive_parent_if_empty: values.archive_parent_if_empty ?? true,
      };
      const { child_batch } = await ProductionAPI.transplant(payload as any);
      toast({ title: "Transplant created", description: `Child batch ${child_batch.batch_number} created` });
      form.reset({
        parent_batch_id: props.parentBatchId as any,
        archive_parent_if_empty: true,
      });
      props.onCreated?.(child_batch);
    } catch (err: any) {
      console.error("[TransplantForm] submit error", err);
      toast({ title: "Failed to transplant", description: String(err?.message ?? err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 text-sm">
        <div className="flex flex-wrap gap-4">
          <div><strong>Parent:</strong> {parent?.batch_number ?? "—"}</div>
          <div><strong>Available units:</strong> {availableUnits}</div>
          <div><strong>Required:</strong> {Number.isFinite(requiredUnits) ? requiredUnits : "—"}</div>
        </div>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...form.register("parent_batch_id")} />

          <FormField name="size_id" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Target size</FormLabel>
              <FormControl>
                <Combobox
                  options={sizes.map(s => ({
                    value: s.id,
                    label: `${s.name}${s.cell_multiple ? ` (${s.cell_multiple}/tray)` : ""}`,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select size"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField name="newLocationId" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Target location</FormLabel>
              <FormControl>
                <Combobox
                  options={locations.map(l => ({
                    value: l.id,
                    label: `${l.name}${l.covered ? " (covered)" : ""}`,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select location"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField name="containers" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Containers</FormLabel>
                <FormControl><Input type="number" min={1} step={1} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="planted_at" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Transplant date</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="archive_parent_if_empty" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Archive parent if empty</FormLabel>
                <Select value={(field.value ? "yes" : "no")} onValueChange={(v) => field.onChange(v === "yes")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField name="notes" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl><Textarea rows={3} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="flex items-center justify-between">
            <div className={`text-sm ${insufficient ? "text-red-600" : "text-muted-foreground"}`}>
              {selectedSize
                ? `Required = containers × ${cellMultiple} = ${Number.isFinite(requiredUnits) ? requiredUnits : "—"}`
                : "Select a size to see required units"}
            </div>
            <Button type="submit" disabled={loading || insufficient || !selectedSize || !parent}>
              {insufficient ? "Not enough stock" : (loading ? "Transplanting…" : "Create transplant")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
