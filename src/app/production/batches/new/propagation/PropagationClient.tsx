"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createPropagationBatchAction } from "@/app/actions/production";
import { useToast } from "@/hooks/use-toast";
import type { NurseryLocation, PlantSize, Variety } from "@/lib/types";
import { propagationFormSchema, type PropagationFormValues } from "@/app/production/forms/propagation-schema";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PropagationClientProps {
    nurseryLocations: NurseryLocation[];
    plantSizes: PlantSize[];
    varieties: Variety[];
}

type NormalizedVariety = { id: string; name: string; family?: string | null };
type NormalizedSize = {
  id: string;
  name: string;
  cellMultiple: number;
  containerType?: string | null;
};
type NormalizedLocation = {
  id: string;
  name: string;
  nurserySite?: string | null;
};

export default function PropagationClient({
  nurseryLocations,
  plantSizes,
  varieties,
}: PropagationClientProps) {
    const router = useRouter();
    const { toast } = useToast();

  const varietyOptions = React.useMemo<NormalizedVariety[]>(
    () =>
      varieties.map((v: any) => ({
        id: v.id,
        name: v.name,
        family: v.family ?? v.family_name ?? null,
      })),
    [varieties],
  );

  const sizeOptions = React.useMemo<NormalizedSize[]>(
    () =>
      plantSizes.map((s: any) => ({
        id: s.id,
        name: s.name,
        containerType: s.containerType ?? s.container_type ?? null,
        cellMultiple: Number(s.cellMultiple ?? s.cell_multiple ?? s.multiple ?? 1) || 1,
      })),
    [plantSizes],
  );

  const locationOptions = React.useMemo<NormalizedLocation[]>(
    () =>
      nurseryLocations.map((l: any) => ({
        id: l.id ?? l.value ?? "",
        name: l.name ?? "",
        nurserySite: l.nurserySite ?? l.nursery_site ?? null,
      })),
    [nurseryLocations],
  );

  const optionsLoading =
    varietyOptions.length === 0 && sizeOptions.length === 0 && locationOptions.length === 0;

  const defaultValues: PropagationFormValues = {
    varietyId: "",
    variety: "",
    family: "",
    sizeId: "",
    sizeMultiple: 1,
    fullTrays: 0,
    partialCells: 0,
    locationId: "",
    plantingDate: new Date().toISOString().split("T")[0],
  };

  const form = useForm<PropagationFormValues>({
    resolver: zodResolver(propagationFormSchema),
    defaultValues,
  });

  const selectedSizeId = form.watch("sizeId");
  React.useEffect(() => {
    const match = sizeOptions.find((s) => s.id === selectedSizeId);
    if (match) {
      form.setValue("sizeMultiple", match.cellMultiple, { shouldDirty: true });
    }
  }, [selectedSizeId, sizeOptions, form]);

  const onSubmit = async (values: PropagationFormValues) => {
    const payload = {
      ...values,
      varietyId: values.varietyId,
      family: values.family || null,
    };
    const result = await createPropagationBatchAction(payload);

        if (result.success) {
      toast({
        title: "Batch Created",
        description: `Batch ${result.data?.batch_number ?? result.data?.id ?? ""} started.`,
      });
      form.reset(defaultValues);
      router.push("/production/batches");
        } else {
      toast({
        title: "Error",
        description: result.error || "Failed to create batch",
        variant: "destructive",
      });
        }
    };

  if (optionsLoading) {
    return (
      <div className="container mx-auto max-w-3xl py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">New Propagation Batch</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Loading reference data…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">New Propagation Batch</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="col-span-2">
                  <FormLabel>Variety</FormLabel>
                  <Select
                  value={form.watch("varietyId")}
                    onValueChange={(value) => {
                    form.setValue("varietyId", value, { shouldValidate: true });
                    const match = varietyOptions.find((v) => v.id === value);
                    form.setValue("variety", match?.name ?? "", { shouldDirty: true });
                      form.setValue("family", match?.family ?? "", { shouldDirty: true });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a variety" />
                    </SelectTrigger>
                    <SelectContent>
                      {varietyOptions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                <InlineFieldError msg={form.formState.errors.varietyId?.message} />
                </div>

                <div>
                  <FormLabel>Family (Optional)</FormLabel>
                  <Input placeholder="e.g. Lamiaceae" {...form.register("family")} />
                  <InlineFieldError msg={form.formState.errors.family?.message} />
                </div>

                <div>
                  <FormLabel>Planting Date</FormLabel>
                  <Input type="date" {...form.register("plantingDate")} />
                  <InlineFieldError msg={form.formState.errors.plantingDate?.message} />
                </div>

                <div>
                  <FormLabel>Size / Container</FormLabel>
                  <Select
                    value={form.watch("sizeId")}
                    onValueChange={(value) => form.setValue("sizeId", value, { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a size" />
                    </SelectTrigger>
                    <SelectContent>
                      {sizeOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.containerType ? ` · ${s.containerType}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <InlineFieldError msg={form.formState.errors.sizeId?.message} />
                </div>

                <div>
                  <FormLabel>Cells per Tray</FormLabel>
                  <Input
                    type="number"
                    {...form.register("sizeMultiple", { valueAsNumber: true })}
                  />
                  <InlineFieldError msg={form.formState.errors.sizeMultiple?.message} />
                </div>

                <div>
                  <FormLabel>Full Trays</FormLabel>
                  <Input type="number" {...form.register("fullTrays", { valueAsNumber: true })} />
                  <InlineFieldError msg={form.formState.errors.fullTrays?.message} />
                </div>

                <div>
                  <FormLabel>Partial Cells</FormLabel>
                  <Input type="number" {...form.register("partialCells", { valueAsNumber: true })} />
                  <InlineFieldError msg={form.formState.errors.partialCells?.message} />
                </div>

                <div className="col-span-2">
                  <FormLabel>Location</FormLabel>
                  <Select
                    value={form.watch("locationId")}
                    onValueChange={(value) => form.setValue("locationId", value, { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locationOptions.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.nurserySite ? `${loc.nurserySite} · ` : ""}
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <InlineFieldError msg={form.formState.errors.locationId?.message} />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset(defaultValues)}
                  disabled={form.formState.isSubmitting}
                >
                  Reset
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Creating..." : "Create Batch"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
        </div>
    );
}

function InlineFieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}
