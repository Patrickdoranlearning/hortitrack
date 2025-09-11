"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProductionAPI } from "@/lib/production/client";
import { HttpError } from "@/lib/http/fetchJson";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const Schema = z.object({
  status: z.enum(["Growing","Ready","Archived","Sold"]),
  notes: z.string().max(500).optional(),
});

export default function StatusForm({ batchId, current, onDone }: { batchId: string; current: string; onDone?: () => void }) {
  const { toast } = useToast?.() ?? { toast: (x:any)=>alert(x?.title||x?.description||"OK") };
  const form = useForm<z.infer<typeof Schema>>({ resolver: zodResolver(Schema), defaultValues: { status: (["Growing","Ready","Archived","Sold"].includes(current) ? current as any : "Growing") } });
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(values: z.infer<typeof Schema>) {
    setLoading(true);
    try {
      await ProductionAPI.setStatus(batchId, values);
      toast({ title: "Status updated", description: `Now ${values.status}` });
      onDone?.();
    } catch (e) {
      const er = e as HttpError;
      toast({ title: "Update failed", description: er.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="status" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Growing">Growing</SelectItem>
                <SelectItem value="Ready">Ready</SelectItem>
                <SelectItem value="Sold">Sold</SelectItem>
                <SelectItem value="Archived">Archived</SelectItem>
              </SelectContent>
            </Select>
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
        <div className="flex justify-end"><Button type="submit" disabled={loading}>{loading ? "Saving…" : "Update"}</Button></div>
      </form>
    </Form>
  );
}
