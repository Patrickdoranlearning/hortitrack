"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProductionAPI, PropagationInput } from "@/lib/production/client";
import { HttpError } from "@/lib/http/fetchJson";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SelectWithCreate } from "@/components/ui/select-with-create";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MaterialConsumptionPreview } from "@/components/materials/MaterialConsumptionPreview";

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const Schema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  containers: z.coerce.number().int().min(1),
  planted_at: DateOnly.optional(),
  notes: z.string().max(1000).optional(),
});

type Props = {
  defaultLocationId?: string;
  onSubmitSuccess?: (batch: any) => void;
};

export default function PropagationForm({ defaultLocationId, onSubmitSuccess }: Props) {
  const { data: referenceData, loading: refLoading, error: refError, reload } =
    React.useContext(ReferenceDataContext);
  
  // Auto-refresh reference data when user returns from creating a new entity in another tab
  useRefreshOnFocus(reload);
  const toastImpl = useToast?.();
  const toast =
    toastImpl?.toast ??
    ((v: any) => {
      alert(v?.title || v?.description || "OK");
    });

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  const form = useForm<PropagationInput>({
    resolver: zodResolver(Schema),
    defaultValues: {
      planted_at: today,
      containers: 1,
      notes: "",
    },
  });

  const [submitting, setSubmitting] = React.useState(false);
  
  const varieties = React.useMemo(() => referenceData?.varieties ?? [], [referenceData]);
  const sizes = React.useMemo(() => {
    const s = [...(referenceData?.sizes ?? [])];
    return s.sort((a, b) => {
      const isAProp = a.container_type === "prop_tray";
      const isBProp = b.container_type === "prop_tray";
      if (isAProp && !isBProp) return -1;
      if (!isAProp && isBProp) return 1;
      
      const isAPlug = a.container_type === "plug_tray";
      const isBPlug = b.container_type === "plug_tray";
      if (isAPlug && !isBPlug) return -1;
      if (!isAPlug && isBPlug) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [referenceData]);
  const locations = React.useMemo(() => referenceData?.locations ?? [], [referenceData]);

  // Defaults once locations exist
  React.useEffect(() => {
    if (defaultLocationId && locations.length) {
      form.setValue("location_id", defaultLocationId);
    } else if (!defaultLocationId && locations.length && !form.getValues("location_id")) {
      form.setValue("location_id", locations[0].id);
    }
  }, [defaultLocationId, locations, form]);

  const watchVariety = form.watch("plant_variety_id");
  const watchSize = form.watch("size_id");
  const watchLocation = form.watch("location_id");
  const watchContainers = Number(form.watch("containers") || 0);
  const watchDate = form.watch("planted_at");

  const selectedVariety = React.useMemo(
    () => varieties.find((v) => v.id === watchVariety),
    [varieties, watchVariety]
  );
  const selectedSize = React.useMemo(
    () => sizes.find((s) => s.id === watchSize),
    [sizes, watchSize]
  );
  const selectedLocation = React.useMemo(
    () => locations.find((l) => l.id === watchLocation),
    [locations, watchLocation]
  );

  const totalUnits = selectedSize
    ? watchContainers * Math.max(1, selectedSize.cell_multiple)
    : 0;

  // Material consumption preview data
  const consumptionBatches = React.useMemo(() => {
    if (!watchSize || !selectedSize || totalUnits <= 0) return [];
    return [{
      batchId: 'new-propagation',
      sizeId: watchSize,
      sizeName: selectedSize.name,
      quantity: totalUnits,
    }];
  }, [watchSize, selectedSize, totalUnits]);

  async function onSubmit(values: PropagationInput) {
    setSubmitting(true);
    try {
      const { batch } = await ProductionAPI.propagate(values);
      toast({
        title: "Propagation created",
        description: `Batch ${batch?.batch_number ?? ""} created`,
      });
      form.reset({ planted_at: today, containers: 1, notes: "" });
      onSubmitSuccess?.(batch);
    } catch (err) {
      const e = err as HttpError;
      toast({
        title: e.status === 401 ? "Please sign in" : "Failed to create batch",
        description: e.requestId ? `${e.message} (ref ${e.requestId})` : e.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const readiness = [
    { label: "Variety", ok: Boolean(watchVariety) },
    { label: "Size", ok: Boolean(watchSize) },
    { label: "Location", ok: Boolean(watchLocation) },
    { label: "Containers", ok: watchContainers > 0 },
  ];

  if (refLoading && !referenceData) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        Loading propagation data…
      </div>
    );
  }

  if (!referenceData) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Reference data unavailable</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{refError ?? "We couldn’t load the varieties, sizes, or locations."}</span>
          <Button size="sm" variant="outline" onClick={reload}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"
        noValidate
      >
        <div className="space-y-6">
          <SectionCard
            title="Variety & genetics"
            description="Choose the plant line you’re propagating and confirm its family."
          >
            <div className="grid gap-4 lg:grid-cols-4">
              <FormField
                name="plant_variety_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="lg:col-span-2">
                    <FormLabel>Variety</FormLabel>
                    <SelectWithCreate
                      options={varieties.map((v) => ({
                        value: v.id,
                        label: v.name + (v.family ? ` · ${v.family}` : ""),
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      createHref="/varieties"
                      placeholder="Search or pick a variety"
                      createLabel="Add new variety"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Family (auto)</FormLabel>
                <Input value={selectedVariety?.family ?? ""} readOnly className="bg-muted/50" />
                <p className="mt-1 text-[10px] text-muted-foreground leading-tight">
                  From Data Management.
                </p>
              </FormItem>

              <FormField
                name="planted_at"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Planting date</FormLabel>
                    <Input type="date" {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Tray setup"
            description="Pick the tray or pot size and enter the number of containers being started."
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <FormField
                name="size_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Size / Container</FormLabel>
                    <SelectWithCreate
                      options={sizes.map((s) => ({
                        value: s.id,
                        label: s.name + (s.container_type ? ` · ${s.container_type}` : ""),
                        badge: s.container_type === "prop_tray" ? (
                          <Badge variant="outline" className="ml-2 bg-primary/5 text-[10px] uppercase tracking-wider py-0 px-1 border-primary/20 text-primary">
                            Prop
                          </Badge>
                        ) : undefined,
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      createHref="/sizes"
                      placeholder="Select a size"
                      createLabel="Add new size"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Cells per container</FormLabel>
                <Input
                  readOnly
                  value={selectedSize?.cell_multiple ?? "—"}
                  className="bg-muted/50 text-muted-foreground"
                />
                <p className="mt-1 text-[10px] text-muted-foreground leading-tight">
                  From size definition.
                </p>
              </FormItem>

              <FormField
                name="containers"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Containers (trays/pots)</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <Input type="number" min={1} step={1} {...field} className="flex-1" />
                        {totalUnits > 0 && (
                          <div className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/5 px-3 py-2 rounded-md border border-primary/10 shrink-0">
                            <span className="text-muted-foreground font-normal">Total:</span>
                            {totalUnits.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Location & notes"
            description="Tell us where these trays are going and capture any observations."
          >
            <div className="grid gap-4">
              <FormField
                name="location_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nursery location</FormLabel>
                    <SelectWithCreate
                      options={locations.map((loc) => ({
                        value: loc.id,
                        label: (loc.nursery_site ? `${loc.nursery_site} · ` : "") + loc.name,
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      createHref="/locations"
                      placeholder="Select a bench or tunnel"
                      createLabel="Add new location"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="notes"
                control={form.control}
                render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
                    <Textarea
                      rows={3}
                      placeholder="e.g. Use bottom heat for first 48 hours."
                      {...field}
                    />
            <FormMessage />
          </FormItem>
                )}
              />
            </div>
          </SectionCard>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset({ planted_at: today, containers: 1, notes: "" })}
              disabled={submitting}
            >
              Reset
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create propagation"}
          </Button>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="space-y-4 p-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completion</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {readiness.map((item) => (
                  <Badge key={item.label} variant={item.ok ? "default" : "secondary"}>
                    {item.label}
                    {!item.ok && <span className="ml-1 text-xs">(pending)</span>}
                  </Badge>
                ))}
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              <SummaryRow label="Variety" value={selectedVariety?.name ?? "—"} />
              <SummaryRow label="Family" value={selectedVariety?.family ?? "—"} />
              <SummaryRow label="Size" value={selectedSize?.name ?? "—"} />
              <SummaryRow
                label="Containers"
                value={watchContainers ? watchContainers.toLocaleString() : "—"}
              />
              <SummaryRow
                label="Calculated units"
                value={
                  totalUnits
                    ? `${totalUnits.toLocaleString()} ${
                        totalUnits === 1 ? "plant" : "plants"
                      }`
                    : "—"
                }
              />
              <SummaryRow label="Location" value={selectedLocation?.name ?? "—"} />
              <SummaryRow label="Planting date" value={watchDate || "—"} />
            </dl>
          </Card>
          {consumptionBatches.length > 0 && (
            <MaterialConsumptionPreview batches={consumptionBatches} />
          )}
          {refError && (
            <Alert variant="destructive">
              <AlertTitle>Reference data warning</AlertTitle>
              <AlertDescription className="text-sm">
                {refError}. You can still submit, but dropdowns might be incomplete.
              </AlertDescription>
            </Alert>
          )}
        </aside>
      </form>
    </Form>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="space-y-4 p-4">
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

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-1 text-sm last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
