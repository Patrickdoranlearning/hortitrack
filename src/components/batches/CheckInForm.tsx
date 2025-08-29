// src/components/batches/CheckInForm.tsx
"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActiveOrg } from "@/lib/org/context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Loader2 } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { AsyncCombobox } from "@/components/ui/AsyncCombobox";
import { Switch } from "@/components/ui/switch";

const CheckinFormSchema = z.object({
  plant_variety_id: z.string().uuid({ message: "Variety is required." }),
  size_id: z.string().uuid({ message: "Size is required." }),
  location_id: z.string().uuid({ message: "Location is required." }),
  supplier_id: z.string().uuid().optional().nullable(),
  quantity: z.coerce.number().int().min(0, { message: "Quantity cannot be negative." }),
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

export function CheckinForm({ onSubmitSuccess, onCancel }: CheckinFormProps) {
  const { toast } = useToast();
  const { orgId } = useActiveOrg();
  const [formLoading, setFormLoading] = useState(false);
  const [ppOverrideEnabled, setPpOverrideEnabled] = useState<boolean>(false);
  const [pestObserved, setPestObserved] = useState<boolean>(false);
  const [diseaseObserved, setDiseaseObserved] = useState<boolean>(false);

  const form = useForm<CheckinFormInput>({
    resolver: zodResolver(CheckinFormSchema),
    mode: "onChange",
    defaultValues: {
      plant_variety_id: "" as any,
      size_id: "" as any,
      location_id: "" as any,
      supplier_id: null,
      quantity: 0,
      quality_rating: 0,
      passport_override_a: "",
      passport_override_b: "",
      passport_override_c: "",
      passport_override_d: "",
      pest_notes: "",
      disease_notes: "",
    },
  });

  // 6-star rating control used by Quality field
  function StarRating({
    value = 0,
    onChange,
  }: {
    value?: number;
    onChange: (n: number) => void;
  }) {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`Set ${n} stars`}
            className={cn(
              "p-1 rounded-md",
              value >= n ? "opacity-100" : "opacity-40 hover:opacity-70"
            )}
          >
            <Star
              className="h-5 w-5"
              fill={value >= n ? "currentColor" : "none"}
              strokeWidth={1.5}
            />
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(0)}
          className="ml-2 text-xs underline"
          aria-label="Clear rating"
        >
          Clear
        </button>
      </div>
    );
  }

  async function onSubmit(values: CheckinFormInput) {
    if (!orgId) {
      toast({ variant: "destructive", title: "No Org Selected", description: "Select an organization first." });
      return;
    }
    setFormLoading(true);
    try {
      const payload = { ...values, orgId };

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
      onSubmitSuccess?.(newBatch);
    } catch (e: any) {
      console.error("Check-in failed:", e);
      toast({ variant: "destructive", title: "Check-in Failed", description: e.message });
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Variety */}
        <FormField
          control={form.control}
          name="plant_variety_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Variety</FormLabel>
              <FormControl>
                <AsyncCombobox
                  endpoint="/api/options/varieties"
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v)}
                  placeholder="Search varieties"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Size */}
        <FormField
          control={form.control}
          name="size_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Size</FormLabel>
              <FormControl>
                <AsyncCombobox
                  endpoint="/api/options/sizes"
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v)}
                  placeholder="Search sizes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Location */}
        <FormField
          control={form.control}
          name="location_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <AsyncCombobox
                  endpoint="/api/options/locations"
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v)}
                  placeholder="Search locations"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Supplier */}
        <FormField
          control={form.control}
          name="supplier_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Supplier</FormLabel>
              <FormControl>
                <AsyncCombobox
                  endpoint="/api/options/suppliers"
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v)}
                  placeholder="Search suppliers"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quantity */}
        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity</FormLabel>
              <FormControl>
                <Input type="number" min={0} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quality */}
        <FormField
          control={form.control}
          name="quality_rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quality Rating</FormLabel>
              <FormControl>
                <StarRating value={field.value ?? 0} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Plant Passport Override */}
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <FormLabel>Plant Passport Override</FormLabel>
            <Switch checked={ppOverrideEnabled} onCheckedChange={setPpOverrideEnabled} />
          </div>
          {ppOverrideEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="passport_override_a"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Override A</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passport_override_b"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Override B</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passport_override_c"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Override C (Supplier Batch)</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passport_override_d"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Override D (Country)</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        {/* Pests & Disease */}
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox id="pestObserved" checked={pestObserved} onCheckedChange={(v) => setPestObserved(Boolean(v))} />
              <label htmlFor="pestObserved" className="text-sm">Pests Observed</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="diseaseObserved" checked={diseaseObserved} onCheckedChange={(v) => setDiseaseObserved(Boolean(v))} />
              <label htmlFor="diseaseObserved" className="text-sm">Disease Observed</label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="pest_notes"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Pest Notes (optional)</FormLabel>
                  <FormControl><Textarea rows={3} {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="disease_notes"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Disease Notes (optional)</FormLabel>
                  <FormControl><Textarea rows={3} {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 z-10 -mx-6 px-6 supports-[backdrop-filter]:bg-background/60 backdrop-blur border-t -mb-6 pt-4 pb-4">
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
