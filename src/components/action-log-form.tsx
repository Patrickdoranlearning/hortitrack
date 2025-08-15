
'use client';
import * as React from "react";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { logAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  type: z.enum(["Spaced","Move","Trimmed","Dumped","Weed","Note"]),
  note: z.string().optional(),
});

export type ActionLogFormValues = z.infer<typeof schema>;

export function ActionLogForm({
  batchId,
  onSubmitted,
  onCancel,
}: {
  batchId: string;
  onSubmitted?: () => void;
  onCancel?: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<ActionLogFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "Spaced",
      note: "",
    },
  });
  const [saving, setSaving] = useState(false);

  if (!batchId) {
    return <div className="p-4 text-center text-red-500">Error: Batch ID is missing.</div>;
  }

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (vals) => {
          setSaving(true);
          try {
            const result = await logAction(batchId, vals as any);
            if (!result.success) throw new Error(result.error);
            toast({ title: "Action Logged", description: `Successfully logged "${vals.type}" action.`});
            onSubmitted?.();
          } catch (e: any) {
            toast({ variant: 'destructive', title: "Log Failed", description: e.message ?? "An unknown error occurred."});
          } finally {
            setSaving(false);
          }
        })}
      >
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Action</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Choose action" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Spaced">Spaced</SelectItem>
                  <SelectItem value="Move">Move</SelectItem>
                  <SelectItem value="Trimmed">Trimmed</SelectItem>
                  <SelectItem value="Dumped">Dumped</SelectItem>
                  <SelectItem value="Weed">Weed</SelectItem>
                  <SelectItem value="Note">Note</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (optional)</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Add details…" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
           <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} aria-disabled={saving}>
            {saving ? "Saving…" : "Log Action"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

    