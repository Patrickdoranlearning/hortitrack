
"use client";
import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectContent, SelectValue, SelectItem,
} from "@/components/ui/select";
import {
  Form, FormField, FormItem, FormLabel, FormMessage, FormControl,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";

import type { Batch, NurseryLocation, PlantSize } from "@/lib/types";

const Actions = ["Move", "Spaced", "Trimmed", "Dumped", "Weed"] as const;

const schema = z.object({
  actions: z.array(z.enum(Actions)).min(1, "Choose at least one action."),
  note: z.string().optional(),
  photoUrls: z.array(z.string().url()).optional(),
  lostQuantity: z.coerce.number().int().min(0).default(0),
  lossReason: z.string().optional(),

  split: z.boolean().default(false),

  allocations: z.array(z.object({
    quantity: z.coerce.number().int().min(0),
    location: z.string().min(1),
    size: z.string().optional(),
    status: z.enum([
      "Propagation",
      "Plugs/Liners",
      "Potted",
      "Ready for Sale",
      "Looking Good",
      "Archived",
    ] as const).optional(),
    supplier: z.string().optional(),
  })).default([]),
});

export type ActionLogFormValues = z.infer<typeof schema>;

type Props = {
  batch: Batch;
  nurseryLocations: NurseryLocation[];
  plantSizes: PlantSize[];
  onSubmitted?: () => void;
  onCancel?: () => void;
};

export function ActionLogForm({
  batch, nurseryLocations, plantSizes, onSubmitted, onCancel,
}: Props) {
  const form = useForm<ActionLogFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      actions: [],
      note: "",
      photoUrls: [],
      lostQuantity: 0,
      lossReason: "",
      split: false,
      allocations: [],
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "allocations",
  });

  const totalAllocated = form.watch("allocations")
    .reduce((s, a) => s + (Number(a.quantity) || 0), 0);
  const lostQty = Number(form.watch("lostQuantity") || 0);
  const remaining = Math.max(0, (batch.quantity || 0) - lostQty - totalAllocated);

  useEffect(() => {
    // If user picks “Dumped”, auto-focusloss reason field; also ensure lostQuantity visible
    const acts = form.getValues("actions");
    if (!acts.includes("Dumped") && form.getValues("lostQuantity") > 0) {
      // keep it, but that's fine
    }
  }, [form, form.watch("actions")]);

  const submit = async (vals: ActionLogFormValues) => {
    if (lostQty + totalAllocated > (batch.quantity || 0)) {
      form.setError("root", { message: "Allocated + Lost exceeds available quantity." });
      return;
    }
    try {
      const res = await fetch(`/api/batches/${batch.id}/allocate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...vals,
          // only send plain values
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to log action");
      }
      onSubmitted?.();
    } catch (e: any) {
      form.setError("root", { message: e.message });
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(submit)} noValidate>
        {/* Actions */}
        <FormField
          control={form.control}
          name="actions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Actions</FormLabel>
              <div className="flex flex-wrap gap-2">
                {Actions.map((a) => {
                  const active = field.value.includes(a);
                  return (
                    <Badge
                      key={a}
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer select-none"
                      onClick={() => {
                        const next = active
                          ? field.value.filter((x) => x !== a)
                          : [...field.value, a];
                        field.onChange(next);
                      }}
                    >
                      {a}
                    </Badge>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Lost quantity (for Dumped) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="lostQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lost Quantity</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} value={field.value ?? 0} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lossReason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loss Reason</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. damping off, pest damage…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Split vs Move-all */}
        <FormField
          control={form.control}
          name="split"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                Force split into new batches (even when moving 100%)
              </FormLabel>
              <div className="text-xs text-muted-foreground">
                If unchecked and you add a single destination with the full remaining quantity,
                the original batch is moved without creating a new one.
              </div>
            </FormItem>
          )}
        />

        {/* Destinations (can be many) */}
        <div className="space-y-2">
          <div className="font-medium">Destinations</div>
          {fields.map((f, idx) => (
            <div key={f.id} className="grid grid-cols-1 sm:grid-cols-10 gap-2 items-end">
              <FormField
                control={form.control}
                name={`allocations.${idx}.quantity`}
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Qty</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} value={field.value ?? 0} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`allocations.${idx}.location`}
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>Location</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a location" />
                      </SelectTrigger>
                      <SelectContent>
                        {(nurseryLocations ?? []).map((l) => (
                          <SelectItem key={l.id} value={l.name}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`allocations.${idx}.size`}
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Size</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Same as current" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Same as current</SelectItem>
                        {(plantSizes ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.size}>
                            {s.size}{s.type ? ` • ${s.type}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`allocations.${idx}.status`}
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={(v) => field.onChange(v || undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Keep current" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Keep current</SelectItem>
                        <SelectItem value="Propagation">Propagation</SelectItem>
                        <SelectItem value="Plugs/Liners">Plugs/Liners</SelectItem>
                        <SelectItem value="Potted">Potted</SelectItem>
                        <SelectItem value="Ready for Sale">Ready for Sale</SelectItem>
                        <SelectItem value="Looking Good">Looking Good</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <div className="sm:col-span-1 flex gap-2">
                <Button type="button" variant="ghost" onClick={() => remove(idx)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({ quantity: 0, location: "", size: "", status: undefined, supplier: undefined })
            }
          >
            + Add destination
          </Button>
          <div className="text-sm text-muted-foreground">
            Allocated: <strong>{totalAllocated}</strong> • Lost:{" "}
            <strong>{lostQty}</strong> • Remaining after submit:{" "}
            <strong>{remaining}</strong>
          </div>
        </div>

        {/* Notes / Photos */}
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Any details to remember…" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Error */}
        {form.formState.errors.root?.message && (
          <div className="text-red-600 text-sm">{form.formState.errors.root.message}</div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Log Actions"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
    