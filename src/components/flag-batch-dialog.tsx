
'use client';
import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { Batch } from "@/lib/types";

const schema = z.object({
  reason: z.string().min(1, "Reason required"),
  remedy: z.string().optional(),
  severity: z.enum(["low","medium","high"]).default("medium"),
  isTopPerformer: z.boolean().default(false),
});

type Values = z.infer<typeof schema>;

export default function FlagBatchDialog({
  open, onOpenChange, batch, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch: Batch;
  onDone?: () => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      severity: batch?.flag?.severity || "medium",
      reason: batch?.flag?.reason || "",
      remedy: batch?.flag?.remedy || "",
      isTopPerformer: !!batch?.isTopPerformer,
    },
  });
  const saving = form.formState.isSubmitting;
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(`/api/batches/${batch.id}/flags`);
        const j = await r.json();
        if (!cancelled && j?.flags) {
          form.setValue("isTopPerformer", !!j.flags.isTopPerformer);
          // Set other flags if they exist in the form
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [batch.id, open, form]);


  const handleSubmit = async (vals: Values) => {
    try {
        // Set isTopPerformer flag
        await fetch(`/api/batches/${batch.id}/flags`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: "isTopPerformer", value: vals.isTopPerformer }),
        });

        // Set the other flag details
        await fetch(`/api/batches/${batch.id}/log`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "Flagged", flag: {
                reason: vals.reason,
                remedy: vals.remedy,
                severity: vals.severity,
            } }),
        });
        
        onDone?.();
        onOpenChange(false);
    } catch (e) {
        console.error("Failed to save flags", e);
        // Optionally show a toast error
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Flag Batch</DialogTitle></DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            {loading && <div className="text-xs text-muted-foreground">Loading flags…</div>}
             <FormField control={form.control} name="isTopPerformer" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={loading || saving}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Mark as Top Performer</FormLabel>
                    <FormMessage>
                        This makes the batch eligible for protocol generation.
                    </FormMessage>
                  </div>
                </FormItem>
              )} />
            <FormField name="severity" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Severity</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={loading || saving}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="reason" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Issue / Reason</FormLabel>
                <FormControl><Textarea {...field} placeholder="What’s wrong?" disabled={loading || saving}/></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="remedy" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Proposed Remedy (optional)</FormLabel>
                <FormControl><Textarea {...field} placeholder="What should we do?" disabled={loading || saving} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || loading} aria-disabled={saving || loading}>
                {saving ? "Saving…" : "Save Flags"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
