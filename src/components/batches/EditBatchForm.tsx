"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProductionAPI } from "@/lib/production/client";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AsyncCombobox from "@/components/ui/AsyncCombobox";

const Schema = z.object({
  status: z.enum(["Growing","Ready","Sold","Archived"]).optional(),
  location_id: z.string().uuid().optional(),
});

export default function EditBatchForm({
  batch,
  onSubmitSuccess,
}: {
  batch: { id: string; status?: string; location_id?: string } | null;
  onSubmitSuccess?: (res: any) => void;
}) {
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      status: (["Growing","Ready","Sold","Archived"].includes(batch?.status ?? "") ? (batch?.status as any) : undefined),
      location_id: batch?.location_id,
    },
  });

  const [saving, setSaving] = React.useState(false);

  async function onSubmit(values: z.infer<typeof Schema>) {
    if (!batch?.id) return;
    setSaving(true);
    try {
      if (values.location_id && values.location_id !== batch.location_id) {
        await ProductionAPI.move(batch.id, { location_id: values.location_id });
      }
      if (values.status && values.status !== batch.status) {
        await ProductionAPI.setStatus(batch.id, { status: values.status });
      }
      onSubmitSuccess?.({ ok: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="location_id" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Location</FormLabel>
            <FormControl>
              <AsyncCombobox<any>
                name={field.name}
                control={form.control}
                resource="locations"
                placeholder="Select location"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField name="status" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
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

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </form>
    </Form>
  );
}
