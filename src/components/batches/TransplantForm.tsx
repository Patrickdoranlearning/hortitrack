
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ProductionAPI } from "@/lib/production/client";
import { transplantBatchAction } from "@/app/actions/transplant";
import { fetchJson, HttpError } from "@/lib/http/fetchJson";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LocationComboboxGrouped } from "../ui/location-combobox-grouped";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { SearchableSelect } from "../ui/searchable-select";
import { MaterialConsumptionPreview } from "@/components/materials/MaterialConsumptionPreview";
import { invalidateBatches } from "@/lib/swr/keys";
import { useTodayDate, getTodayISO } from "@/lib/date-sync";

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const Schema = z.object({
  parent_batch_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  containers: z.coerce.number().int().min(1),
  planted_at: DateOnly.optional(),
  notes: z.string().max(1000).optional(),
  archive_parent_if_empty: z.boolean().optional(),
});

type ParentSnapshot = {
  id: string;
  batch_number: string;
  quantity: number | null;
  phase?: string | null;
  status?: string | null;
  planted_at?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  location_site?: string | null;
  size_id?: string | null;
  size_name?: string | null;
  size_cell_multiple?: number | null;
  size_container_type?: string | null;
  variety_name?: string | null;
  variety_family?: string | null;
};

type ParentState =
  | { loading: true; data: null; error?: string }
  | { loading: false; data: ParentSnapshot | null; error?: string };

type Props = {
  parentBatchId: string;
  defaultTargetLocationId?: string;
  onCreated?: (child: { id: string; batch_number: string }) => void;
  onCancel?: () => void;
};

export default function TransplantForm({
  parentBatchId,
  defaultTargetLocationId,
  onCreated,
  onCancel,
}: Props) {
  const { data: referenceData, loading: refLoading, error: refError, reload } =
    React.useContext(ReferenceDataContext);
  
  // Auto-refresh reference data when user returns from creating a new entity in another tab
  useRefreshOnFocus(reload);
  
  const toastImpl = (useToast?.() as any) || null;
  const toast =
    toastImpl?.toast ??
    ((v: any) => {
      alert(v?.title || v?.description || "OK");
    });

  // Use hydration-safe date to prevent server/client mismatch
  const today = useTodayDate();

  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      parent_batch_id: parentBatchId,
      containers: undefined,
      planted_at: "", // Empty initially, set after hydration
      archive_parent_if_empty: true,
    },
  });

  // Set date after hydration to avoid mismatch
  React.useEffect(() => {
    if (today && !form.getValues("planted_at")) {
      form.setValue("planted_at", today);
    }
  }, [today, form]);

  const [parentState, setParentState] = React.useState<ParentState>({
    loading: true,
    data: null,
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [writeOffRemainder, setWriteOffRemainder] =
    React.useState<boolean>(false);

  const sizes = React.useMemo(() => referenceData?.sizes ?? [], [referenceData]);
  const locations = React.useMemo(
    () => (referenceData?.locations ?? []).filter((l: any) => !l.is_virtual),
    [referenceData]
  );

  const loadParent = React.useCallback(async () => {
    setParentState((prev) => ({ ...prev, loading: true, error: undefined }) as ParentState);
    try {
      const res = await fetchJson<{ batch: ParentSnapshot }>(
        `/api/production/batches/${parentBatchId}/summary`
      );
      setParentState({ loading: false, data: res.batch });
    } catch (err) {
      const e = err as HttpError;
      setParentState({
        loading: false,
        data: null,
        error: e.message,
      });
    }
  }, [parentBatchId]);

  React.useEffect(() => {
    void loadParent();
  }, [loadParent]);

  React.useEffect(() => {
    const parent = parentState.data;
    if (!parent) return;

    const currentParentId = form.getValues("parent_batch_id");
    if (parent.id && currentParentId !== parent.id) {
      form.setValue("parent_batch_id", parent.id);
    }

    if (!form.getValues("size_id") && parent.size_id) {
      form.setValue("size_id", parent.size_id);
    }
  }, [parentState.data, form]);

  React.useEffect(() => {
    const parent = parentState.data;
    const currentLocation = form.getValues("location_id");
    const fallback =
      defaultTargetLocationId ??
      parent?.location_id ??
      (locations.length ? locations[0].id : undefined);
    if (!currentLocation && fallback) {
      form.setValue("location_id", fallback);
    }
  }, [
    defaultTargetLocationId,
    parentState.data,
    locations,
    form,
  ]);

  const watchSize = form.watch("size_id");
  const watchLocation = form.watch("location_id");
  const watchContainersRaw = form.watch("containers");
  const hasContainers =
    watchContainersRaw !== undefined &&
    watchContainersRaw !== null &&
    !Number.isNaN(Number(watchContainersRaw));
  const watchContainers = hasContainers ? Number(watchContainersRaw) : 0;
  const watchDate = form.watch("planted_at");

  const selectedSize = React.useMemo(
    () => sizes.find((s) => s.id === watchSize),
    [sizes, watchSize]
  );
  const sizeMultiple = selectedSize
    ? Math.max(1, selectedSize.cell_multiple ?? 1)
    : 1;
  const requiredUnits = hasContainers ? watchContainers * sizeMultiple : 0;
  const parentAvailable = parentState.data?.quantity ?? 0;
  const insufficient = hasContainers && requiredUnits > parentAvailable;
  const remainderUnits = React.useMemo(() => {
    if (!hasContainers || !parentAvailable || parentAvailable <= 0) return 0;
    const remainder = parentAvailable - requiredUnits;
    return remainder > 0 ? remainder : 0;
  }, [hasContainers, parentAvailable, requiredUnits]);

  // Material consumption preview data
  const consumptionBatches = React.useMemo(() => {
    if (!watchSize || !selectedSize || requiredUnits <= 0) return [];
    return [{
      batchId: 'new-transplant',
      sizeId: watchSize,
      sizeName: selectedSize.name,
      quantity: requiredUnits,
    }];
  }, [watchSize, selectedSize, requiredUnits]);

  const readiness = [
    { label: "Size", ok: Boolean(watchSize) },
    { label: "Location", ok: Boolean(watchLocation) },
    { label: "Containers", ok: hasContainers && requiredUnits > 0 },
  ];

  async function onSubmit(values: z.infer<typeof Schema>) {
    const remainderToWriteOff =
      writeOffRemainder && remainderUnits > 0 ? remainderUnits : 0;
    setSubmitting(true);
    try {
      const result = await transplantBatchAction({
        parent_batch_id: values.parent_batch_id,
        size_id: values.size_id,
        location_id: values.location_id,
        containers: values.containers,
        planted_at: values.planted_at,
        notes: values.notes,
        archive_parent_if_empty: values.archive_parent_if_empty ?? true,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      const child_batch = result.data.childBatch;

      if (remainderToWriteOff > 0) {
        await ProductionAPI.dump(values.parent_batch_id, {
          units: remainderToWriteOff,
          reason: "Write-off after transplant",
          archive_if_empty: true,
        });
      }

      toast({
        title: "Transplant created",
        description:
          remainderToWriteOff > 0
            ? `Batch ${child_batch.batchNumber} created. ${remainderToWriteOff.toLocaleString()} remaining units written off.`
            : `Batch ${child_batch.batchNumber} created.`,
      });
      // Invalidate batch caches to trigger refresh across all components
      invalidateBatches();
      form.reset({
        parent_batch_id: parentBatchId,
        size_id: values.size_id,
        location_id: values.location_id,
        containers: undefined,
        planted_at: getTodayISO(),
        archive_parent_if_empty: true,
        notes: "",
      });
      setWriteOffRemainder(false);
      onCreated?.({ id: child_batch.id, batch_number: child_batch.batchNumber });
      void loadParent();
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Unknown error");
      toast({
        title: "Failed to transplant",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if ((refLoading && !referenceData) || (parentState.loading && !parentState.data)) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        Loading transplant data…
      </div>
    );
  }

  if (parentState.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Parent batch unavailable</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{parentState.error}</span>
          <Button size="sm" variant="outline" onClick={() => void loadParent()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!referenceData) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Reference data unavailable</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{refError ?? "Sizes or locations failed to load."}</span>
          <Button size="sm" variant="outline" onClick={reload}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const parent = parentState.data;

  return (
    <div className="max-h-[75vh] overflow-y-auto pr-2">
      <Form {...form}>
        <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-6"
        noValidate
      >
        <div className="space-y-6">
          <SectionCard
            title="Destination setup"
            description={
              parent
                ? `${parent.variety_name ?? "Variety unknown"} • ${parentAvailable?.toLocaleString() ?? "—"} units on hand`
                : "Pick the size, location, and date for the new child batch."
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                name="size_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Target size / container</FormLabel>
                    <SearchableSelect
                      options={sizes.map((s) => ({
                        value: s.id,
                        label: s.name,
                        description: `${s.container_type ?? ""}${s.cell_multiple ? ` · ${s.cell_multiple}/tray` : ""}`.trim() || undefined,
                      }))}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      createHref="/sizes"
                      placeholder="Search sizes..."
                      createLabel="Add new size"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="location_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nursery location</FormLabel>
                    <LocationComboboxGrouped
                      locations={locations}
                      value={field.value ?? ""}
                      onSelect={field.onChange}
                      createHref="/locations"
                      placeholder="Search locations..."
                      excludeVirtual
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
                    <FormLabel>Transplant date</FormLabel>
                    <Input type="date" {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Quantities & notes"
            description="Tell us how many containers you’re splitting out and any context."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                name="containers"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Containers (trays / pots)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const next = e.target.value;
                          field.onChange(next ? Number(next) : undefined);
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {selectedSize
                        ? `${watchContainers ? requiredUnits.toLocaleString() : "—"} computed units`
                        : "Select a size to calculate units moved"}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-2 rounded border p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={writeOffRemainder}
                    onCheckedChange={(v) => setWriteOffRemainder(Boolean(v))}
                    disabled={!hasContainers || remainderUnits <= 0 || submitting}
                  />
                  <div className="space-y-1">
                    <FormLabel className="text-sm">
                      Write off remaining units after transplant
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      {hasContainers
                        ? remainderUnits > 0
                          ? `Automatically log ${remainderUnits.toLocaleString()} units as loss once this child batch is created.`
                          : "No remainder to write off with the current quantity."
                        : "Enter containers to see how many units would remain."}
                    </p>
                  </div>
                </div>
              </div>

              <FormField
                name="notes"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <Textarea
                      rows={3}
                      placeholder="Optional context for the log and child batch."
                      {...field}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </SectionCard>

          <div className="flex flex-wrap justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={submitting || insufficient}>
              {insufficient
                ? "Insufficient stock"
                : submitting
                ? "Transplanting…"
                : "Create transplant"}
            </Button>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Parent batch
                </p>
                <p className="text-xl font-semibold">
                  {parent?.batch_number ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {parent?.variety_name
                    ? `${parent.variety_name}${
                        parent.variety_family ? ` · ${parent.variety_family}` : ""
                      }`
                    : "—"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadParent()}
                disabled={parentState.loading}
              >
                Refresh
              </Button>
            </div>
            <dl className="space-y-3 text-sm">
              <SummaryRow
                label="Available units"
                value={
                  parentAvailable !== null
                    ? parentAvailable.toLocaleString()
                    : "—"
                }
              />
              <SummaryRow
                label="Required"
                value={
                  selectedSize
                    ? `${requiredUnits.toLocaleString()}`
                    : "Select a size"
                }
              />
              <SummaryRow
                label="Location"
                value={
                  parent?.location_name
                    ? `${parent.location_site ? `${parent.location_site} · ` : ""}${
                        parent.location_name
                      }`
                    : "—"
                }
              />
              <SummaryRow
                label="Phase"
                value={parent?.phase ? parent.phase : "—"}
              />
              <SummaryRow label="Status" value={parent?.status ?? "—"} />
              <SummaryRow
                label="Last planted"
                value={parent?.planted_at ?? "—"}
              />
              <SummaryRow
                label="Child date"
                value={watchDate || today}
              />
            </dl>
            {insufficient && (
              <Alert variant="destructive">
                <AlertTitle>Not enough units</AlertTitle>
                <AlertDescription className="text-sm">
                  Reduce the container count or pick a different size. Parent
                  only has {parentAvailable?.toLocaleString() ?? 0} units.
                </AlertDescription>
              </Alert>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Completion
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {readiness.map((item) => (
                <Badge key={item.label} variant={item.ok ? "default" : "secondary"}>
                  {item.label}
                  {!item.ok && <span className="ml-1 text-xs">(pending)</span>}
                </Badge>
              ))}
            </div>
          </Card>

          {consumptionBatches.length > 0 && (
            <MaterialConsumptionPreview batches={consumptionBatches} />
          )}
        </aside>
      </form>
    </Form>
  </div>
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
