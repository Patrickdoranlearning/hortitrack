
"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabaseClient } from '@/lib/supabase/client';
import type { Database } from "@/types/supabase"; 

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarDays, ChevronDown, Check, Loader2, Star } from "lucide-react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { AsyncCombobox } from "@/components/common/AsyncCombobox";
import { useActiveOrg } from "@/lib/org/context";
import { useToast } from "@/hooks/use-toast";
import { DialogFooter } from "../ui/dialog";

const CheckinFormSchema = z.object({
  plant_variety_id: z.string().uuid({ message: "Variety is required." }),
  size_id: z.string().uuid({ message: "Size is required." }),
  location_id: z.string().uuid({ message: "Location is required." }),
  supplier_id: z.string().uuid().optional().nullable(),
  quantity: z.coerce.number().int().min(0),
  quality_rating: z.number().int().min(0).max(6).optional(),
  passport_override_a: z.string().optional().nullable(),
  passport_override_b: z.string().optional().nullable(),
  passport_override_c: z.string().optional().nullable(),
  passport_override_d: z.string().optional().nullable(),
  pest_notes: z.string().optional(),
  disease_notes: z.string().optional(),
});

type CheckinFormInput = z.infer<typeof CheckinFormSchema>;

type CheckinFormProps = {
  onSubmitSuccess?: (batch: { batchId: string; batchNumber: string }) => void;
  onCancel: () => void;
};


export function CheckinForm({
  onSubmitSuccess,
  onCancel,
}: CheckinFormProps) {
  const { toast } = useToast();
  const { orgId } = useActiveOrg();
  const [formLoading, setFormLoading] = useState(false);
  
  const [variety, setVariety] = React.useState<{ value: string; label: string; hint?: string } | null>(null);
  const [size, setSize] = React.useState<{ value: string; label: string; meta?: any } | null>(null);
  const [location, setLocation] = React.useState<{ value: string; label: string } | null>(null);
  const [supplier, setSupplier] = React.useState<{ value: string; label: string; meta?: any } | null>(null);


  const form = useForm<CheckinFormInput>({
    resolver: zodResolver(CheckinFormSchema),
    defaultValues: {},
    mode: "onChange",
  });

  const onSubmit = async (values: CheckinFormInput) => {
     if (!orgId) {
      toast({ variant: "destructive", title: "Organization Missing", description: "Please ensure you are associated with an organization." });
      return;
    }
    setFormLoading(true);
    try {
      const payload = { ...values, orgId: orgId };

      const res = await fetch("/api/batches/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to check in batch.");
      }

      const result = await res.json();
      const newBatch = result.batch?.[0] ?? result.batch;
      toast({ title: "Check-in Successful", description: `Batch #${newBatch.batch_number} created.` });
      form.reset();
      if (onSubmitSuccess) onSubmitSuccess(newBatch);
    } catch (e: any) {
      console.error("Check-in failed:", e);
      toast({ variant: "destructive", title: "Check-in Failed", description: e.message });
    } finally {
      setFormLoading(false);
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="plant_variety_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Variety</FormLabel>
                <AsyncCombobox
                    value={variety}
                    onChange={(opt) => {
                    setVariety(opt);
                    field.onChange(opt?.value ?? "");
                    if (opt?.hint && !form.getValues("passport_override_a")) {
                        form.setValue("passport_override_a", opt.hint);
                    }
                    }}
                    fetchUrl="/api/catalog/varieties"
                    placeholder="Search variety..."
                    autofocus
                />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="size_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Size</FormLabel>
                <AsyncCombobox
                    value={size}
                    onChange={(opt) => {
                    setSize(opt);
                    field.onChange(opt?.value ?? "");
                    }}
                    fetchUrl="/api/catalog/sizes?for=checkin"
                    placeholder="Select size..."
                />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
                <AsyncCombobox
                    value={location}
                    onChange={(opt) => { setLocation(opt); field.onChange(opt?.value ?? ""); }}
                    fetchUrl="/api/catalog/locations"
                    placeholder="Search location..."
                />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="supplier_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Supplier</FormLabel>
                <AsyncCombobox
                    value={supplier}
                    onChange={(opt) => {
                    setSupplier(opt);
                    field.onChange(opt?.value ?? "");
                    const pc = opt?.meta?.producer_code ?? "IE2727";
                    const cc = opt?.meta?.country_code ?? "IE";
                    if (!form.getValues("passport_override_b")) form.setValue("passport_override_b", pc);
                    if (!form.getValues("passport_override_d")) form.setValue("passport_override_d", cc);
                    }}
                    fetchUrl="/api/catalog/suppliers"
                    placeholder="Search supplier..."
                />
                <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="sticky bottom-0 z-10 -mx-6 px-6 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t -mb-6 pt-4 pb-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={formLoading}>Cancel</Button>
          <Button type="submit" disabled={formLoading} aria-disabled={formLoading}>
            {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
