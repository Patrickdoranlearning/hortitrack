
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

const schema = z.object({
  reason: z.string().min(1, "Reason required"),
  remedy: z.string().optional(),
  severity: z.enum(["low","medium","high"]).default("medium")
});

type Values = z.infer<typeof schema>;

export default function FlagBatchDialog({
  open, onOpenChange, batchId, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batchId: string;
  onDone?: () => void;
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { severity: "medium" } });
  const saving = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Flag Batch</DialogTitle></DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (vals) => {
              const res = await fetch(`/api/batches/${batchId}/log`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ type: "Flagged", flag: vals }),
              });
              if (!res.ok) { alert("Failed to flag"); return; }
              onDone?.();
              onOpenChange(false);
            })}
          >
            <FormField name="severity" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Severity</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
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
                <FormControl><Textarea {...field} placeholder="What’s wrong?" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="remedy" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Proposed Remedy (optional)</FormLabel>
                <FormControl><Textarea {...field} placeholder="What should we do?" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} aria-disabled={saving}>Flag</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
