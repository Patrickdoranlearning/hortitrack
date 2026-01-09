"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProductionAPI } from "@/lib/production/client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectWithCreate } from "@/components/ui/select-with-create";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCollection } from "@/hooks/useCollection";
import { Card } from "@/components/ui/card";
import {
  NurseryLocation,
  PlantSize,
  Supplier,
  Batch,
} from "@/lib/types";

const Schema = z.object({
  status: z.enum(["Growing", "Ready", "Sold", "Archived"]).optional(),
  location_id: z.string().uuid().optional(),
  size_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  planted_at: z.string().optional(), // YYYY-MM-DD
  quantity: z
    .number()
    .int()
    .nonnegative({ message: "Quantity must be zero or greater" })
    .optional(),
});

const statusOptions: Array<{ label: string; value: z.infer<typeof Schema>["status"] }> =
  [
    { label: "Growing", value: "Growing" },
    { label: "Ready", value: "Ready" },
    { label: "Sold", value: "Sold" },
    { label: "Archived", value: "Archived" },
  ];

type FormValues = z.infer<typeof Schema>;

export default function EditBatchForm({
  batch,
  onSubmitSuccess,
}: {
  batch: Batch | null;
  onSubmitSuccess?: (res: any) => void;
}) {
  const { toast } = useToast();
  const { data: locationsData } = useCollection<NurseryLocation>(
    "nursery_locations"
  );
  const { data: sizeData } = useCollection<PlantSize>("plant_sizes");
  const { data: supplierData } = useCollection<Supplier>("suppliers");

  const defaultValues = React.useMemo<FormValues>(
    () => ({
      status: (statusOptions.some((o) => o.value === batch?.status)
        ? (batch?.status as FormValues["status"])
        : undefined) as FormValues["status"],
      location_id: (batch as any)?.locationId ?? (batch as any)?.location_id,
      size_id: (batch as any)?.sizeId ?? (batch as any)?.size_id,
      supplier_id: (batch as any)?.supplierId ?? (batch as any)?.supplier_id,
      planted_at: batch?.plantedAt?.slice(0, 10) ?? undefined,
      quantity: batch?.quantity ?? undefined,
    }),
    [batch]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues,
  });

  React.useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const [saving, setSaving] = React.useState(false);

  async function onSubmit(values: FormValues) {
    if (!batch?.id) return;
    const payload: Record<string, unknown> = {};

    const selectedLocation = locationsData?.find(
      (loc) => loc.id === values.location_id
    );
    const selectedSize = sizeData?.find((size) => size.id === values.size_id);
    const selectedSupplier = supplierData?.find(
      (sup) => sup.id === values.supplier_id
    );

    if (selectedLocation && selectedLocation.name !== batch.location) {
      payload.location = selectedLocation.name;
    }
    if (selectedSize && selectedSize.name !== batch.size) {
      payload.size = selectedSize.name;
    }
    if (selectedSupplier && selectedSupplier.name !== (batch as any)?.supplier) {
      payload.supplier = selectedSupplier.name;
    }
    if (
      values.planted_at &&
      values.planted_at !== batch?.plantedAt?.slice(0, 10)
    ) {
      payload.plantingDate = values.planted_at;
    }
    if (
      typeof values.quantity === "number" &&
      values.quantity !== batch?.quantity
    ) {
      payload.quantity = values.quantity;
    }
    if (values.status && values.status !== batch?.status) {
      payload.status = values.status;
    }

    if (!Object.keys(payload).length) {
      toast({
        title: "No changes detected",
        description: "Adjust a field before saving.",
      });
      return;
    }

    setSaving(true);
    try {
      await ProductionAPI.updateBatch(batch.id!, payload);
      toast({ title: "Batch updated", description: "Changes were saved." });
      onSubmitSuccess?.({ ok: true });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: err?.message ?? "Unable to save changes.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid max-h-[75vh] grid-rows-[auto_1fr_auto] gap-6"
      >
        <Card className="rounded-lg border bg-muted/10 p-4 text-sm text-muted-foreground">
          Use this form to correct batch data after upload—changes will be logged.
        </Card>

        <div className="overflow-y-auto pr-1">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SectionCard
              title="Location & supplier"
              description="Choose the physical placement and attribution for this batch."
            >
              <div className="grid gap-4">
                <FormField
                  name="location_id"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <SelectWithCreate
                        options={(locationsData ?? []).map((loc) => ({
                          value: loc.id!,
                          label: (loc.nurserySite ? `${loc.nurserySite} • ` : "") + loc.name,
                        }))}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        createHref="/locations"
                        placeholder="Select location"
                        createLabel="Add new location"
                        disabled={!locationsData?.length}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="supplier_id"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <SelectWithCreate
                        options={(supplierData ?? []).map((sup) => ({
                          value: sup.id!,
                          label: sup.name,
                        }))}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        createHref="/suppliers"
                        placeholder="Select supplier"
                        createLabel="Add new supplier"
                        disabled={!supplierData?.length}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Size & dates"
              description="Adjust pot size or planting date if data entry was wrong."
            >
              <div className="grid gap-4">
                <FormField
                  name="size_id"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size</FormLabel>
                      <SelectWithCreate
                        options={(sizeData ?? []).map((size) => ({
                          value: size.id!,
                          label: size.name + (size.containerType ? ` · ${size.containerType}` : ""),
                        }))}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        createHref="/sizes"
                        placeholder="Select size"
                        createLabel="Add new size"
                        disabled={!sizeData?.length}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="planted_at"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planting date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Quantities & status"
              description="Set the correct current stock level and lifecycle state."
              className="lg:col-span-2"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  name="quantity"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value!}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`space-y-4 p-4 ${className ?? ""}`}>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </Card>
  );
}
