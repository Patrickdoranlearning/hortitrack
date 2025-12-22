
"use client";

import * as React from "react";
import { PageFrame } from "@/ui/templates/PageFrame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogForm } from "@/ui/templates/DialogForm";
import { createPropagationBatchAction } from "@/app/actions/production";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { propagationFormSchema } from "@/app/production/forms/propagation-schema";
import useSWR from "swr";
import { fetchJson } from "@/lib/http";
import { Skeleton } from "@/components/ui/skeleton";

type VarOption = { id: string; name: string; family?: string | null };
type SizeOption = {
  id: string;
  name: string;
  cellMultiple: number;
  containerType?: string | null;
};
type LocationOption = {
  id: string;
  name: string;
  nurserySite?: string | null;
};

type ProductionStats = {
  batchesInPropagation: number;
  readyForSale: number;
  lossLast7Days: number;
};

export default function ProductionHome() {
  const { toast } = useToast();
  const { data: refData, loading: refLoading } = React.useContext(ReferenceDataContext);

  // Fetch production stats
  const { data: stats, isLoading: statsLoading, error: statsError } = useSWR<ProductionStats>(
    "/api/production/stats",
    fetchJson,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

  const varietyOptions = React.useMemo<VarOption[]>(() => {
    return (refData?.varieties ?? []).map((v: any) => ({
      id: v.id,
      name: v.name,
      family: v.family ?? v.family_name ?? null,
    }));
  }, [refData?.varieties]);

  const sizeOptions = React.useMemo<SizeOption[]>(() => {
    return (refData?.sizes ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      containerType: s.containerType ?? s.container_type ?? null,
      cellMultiple: Number(s.cellMultiple ?? s.cell_multiple ?? s.multiple ?? 1) || 1,
    }));
  }, [refData?.sizes]);

  const locationOptions = React.useMemo<LocationOption[]>(() => {
    return (refData?.locations ?? []).map((l: any) => ({
      id: l.id ?? l.value ?? "",
      name: l.name ?? "",
      nurserySite: l.nurserySite ?? l.nursery_site ?? null,
    }));
  }, [refData?.locations]);

  return (
    <PageFrame moduleKey="production">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl">Production</h1>
        <DialogForm
          title="New Propagation Batch"
          description="Start a new batch from propagation (seed/cuttings)."
          schema={propagationFormSchema}
          defaultValues={{
            varietyId: "",
            variety: "",
            family: "",
            sizeId: "",
            sizeMultiple: 1,
            fullTrays: 0,
            partialCells: 0,
            locationId: "",
            plantingDate: new Date().toISOString().split('T')[0]
          }}
          trigger={
            <Button variant="accent" disabled={refLoading}>
              New Batch
            </Button>
          }
          onSubmit={async (values) => {
            try {
              const res = await createPropagationBatchAction({
                ...values,
                varietyId: values.varietyId,
                variety: values.variety,
                family: values.family || null,
              });

              if (res.success) {
                toast({
                  title: "Batch Created",
                  description: `Batch ${res.data?.batch_number} started successfully.`
                });
                return true; // Close dialog on success
              } else {
                toast({
                  title: "Error creating batch",
                  description: res.error || "Failed to create batch. Please try again.",
                  variant: "destructive"
                });
                return false; // Keep dialog open on error
              }
            } catch (error: any) {
              console.error("[ProductionHome] Error creating batch:", error);
              toast({
                title: "Error",
                description: error?.message || "An unexpected error occurred. Please try again.",
                variant: "destructive"
              });
              return false;
            }
          }}
        >
          {({ form }) => (
            <div className="grid gap-4 md:grid-cols-2">
              {refLoading ? (
                <div className="col-span-2 text-sm text-muted-foreground">
                  Loading reference data...
                </div>
              ) : null}
              <div className="col-span-2">
                <Label htmlFor="variety">Variety</Label>
                <Select
                  value={form.watch("varietyId")}
                  onValueChange={(value) => {
                    form.setValue("varietyId", value, { shouldValidate: true });
                    const selected = varietyOptions.find((v) => v.id === value);
                    form.setValue("variety", selected?.name ?? "", { shouldDirty: true });
                    form.setValue("family", selected?.family ?? "", { shouldDirty: true });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={refLoading ? "Loading varieties..." : "Select a variety"} />
                  </SelectTrigger>
                  <SelectContent>
                    {varietyOptions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError msg={form.formState.errors.varietyId?.message} />
              </div>

              <div>
                <Label htmlFor="family">Family (Optional)</Label>
                <Input id="family" {...form.register("family")} placeholder="e.g. Lamiaceae" />
                <FieldError msg={form.formState.errors.family?.message} />
              </div>

              <div>
                <Label htmlFor="plantingDate">Planting Date</Label>
                <Input id="plantingDate" type="date" {...form.register("plantingDate")} />
                <FieldError msg={form.formState.errors.plantingDate?.message} />
              </div>

              <div>
                <Label htmlFor="sizeId">Size / Container</Label>
                <Select
                  value={form.watch("sizeId")}
                  onValueChange={(value) => {
                    form.setValue("sizeId", value, { shouldValidate: true });
                    const selected = sizeOptions.find((s) => s.id === value);
                    if (selected) {
                      form.setValue("sizeMultiple", selected.cellMultiple, { shouldDirty: true });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={refLoading ? "Loading sizes..." : "Select a size"} />
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
                <FieldError msg={form.formState.errors.sizeId?.message} />
              </div>

              <div>
                <Label htmlFor="sizeMultiple">Cells per Tray</Label>
                <Input id="sizeMultiple" type="number" {...form.register("sizeMultiple", { valueAsNumber: true })} />
                <FieldError msg={form.formState.errors.sizeMultiple?.message} />
              </div>

              <div>
                <Label htmlFor="fullTrays">Full Trays</Label>
                <Input id="fullTrays" type="number" {...form.register("fullTrays", { valueAsNumber: true })} />
                <FieldError msg={form.formState.errors.fullTrays?.message} />
              </div>

              <div>
                <Label htmlFor="partialCells">Partial Cells</Label>
                <Input id="partialCells" type="number" {...form.register("partialCells", { valueAsNumber: true })} />
                <FieldError msg={form.formState.errors.partialCells?.message} />
              </div>

              <div className="col-span-2">
                <Label htmlFor="locationId">Location</Label>
                <Select
                  value={form.watch("locationId")}
                  onValueChange={(value) => form.setValue("locationId", value, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={refLoading ? "Loading locations..." : "Select a location"} />
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
                <FieldError msg={form.formState.errors.locationId?.message} />
              </div>
            </div>
          )}
        </DialogForm>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Batches in Propagation</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">
            {statsLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : statsError ? (
              <span className="text-muted-foreground text-lg">Error</span>
            ) : (
              stats?.batchesInPropagation ?? 0
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ready for Sale</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">
            {statsLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : statsError ? (
              <span className="text-muted-foreground text-lg">Error</span>
            ) : (
              stats?.readyForSale ?? 0
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Loss (last 7 days)</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">
            {statsLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : statsError ? (
              <span className="text-muted-foreground text-lg">Error</span>
            ) : (
              stats?.lossLast7Days ?? 0
            )}
          </CardContent>
        </Card>
      </div>
    </PageFrame>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-600">{msg}</p>
}
