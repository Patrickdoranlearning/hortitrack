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
  location_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

type Location = { id: string; name: string };

export default function MoveForm({ batchId, onDone }: { batchId: string; onDone?: () => void }) {
  const { add: toast } = useToast();
  const form = useForm<z.infer<typeof Schema>>({ resolver: zodResolver(Schema) });
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/lookups/locations")
      .then(r => r.json())
      .then(j => setLocations(j.data || []))
      .catch(() => setLocations([]));
  }, []);

  async function onSubmit(values: z.infer<typeof Schema>) {
    setLoading(true);
    try {
      await ProductionAPI.move(batchId, values);
      toast({ title: "Moved", description: "Batch location updated." });
      onDone?.();
    } catch (e) {
      const er = e as HttpError;
      toast({ title: "Move failed", description: er.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="location_id" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>New location</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>
                {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
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
        <div className="flex justify-end"><Button type="submit" disabled={loading}>{loading ? "Moving…" : "Move"}</Button></div>
      </form>
    </Form>
  );
}
