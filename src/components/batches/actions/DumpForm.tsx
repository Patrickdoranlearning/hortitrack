"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProductionAPI } from "@/lib/production/client";
import { HttpError } from "@/lib/http/fetchJson";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const Schema = z.object({
  units: z.coerce.number().int().positive(),
  reason: z.string().min(2).max(200),
  archive_if_empty: z.boolean().optional().default(true),
  notes: z.string().max(500).optional(),
});

export default function DumpForm({ batchId, available, onDone }: { batchId: string; available: number; onDone?: (newQty: number)=>void }) {
  const { add: toast } = useToast();
  const form = useForm<z.infer<typeof Schema>>({ resolver: zodResolver(Schema), defaultValues: { archive_if_empty: true } });
  const [loading, setLoading] = React.useState(false);
  const units = Number(form.watch("units") || 0);
  const tooMuch = units > (available ?? 0);

  async function onSubmit(values: z.infer<typeof Schema>) {
    setLoading(true);
    try {
      const { new_quantity } = await ProductionAPI.dump(batchId, values);
      toast({ title: "Dump recorded", description: `${values.units} unit(s) removed` });
      onDone?.(new_quantity);
    } catch (e) {
      const er = e as HttpError;
      toast({ title: "Dump failed", description: er.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="text-sm text-muted-foreground">Available: {available ?? "—"}</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField name="units" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Units to remove</FormLabel>
              <FormControl><Input type="number" min={1} step={1} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="reason" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Reason</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mortality">Mortality</SelectItem>
                  <SelectItem value="Quality Reject">Quality Reject</SelectItem>
                  <SelectItem value="Lost/Breakage">Lost/Breakage</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="archive_if_empty" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Archive if empty</FormLabel>
              <Select value={(field.value ? "yes" : "no")} onValueChange={(v)=>field.onChange(v==="yes")}>
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
          <div className={`text-sm ${tooMuch ? "text-red-600" : "text-muted-foreground"}`}>
            {tooMuch ? "Exceeds available units" : " "}
          </div>
          <Button type="submit" disabled={loading || tooMuch || !available}>
            {loading ? "Saving…" : "Record dump"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
