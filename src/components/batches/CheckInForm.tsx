"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProductionAPI, CheckInInput } from "@/lib/production/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "../ui/searchable-select";
import { VarietyComboboxGrouped } from "../ui/variety-combobox-grouped";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MaterialConsumptionPreview } from "@/components/materials/MaterialConsumptionPreview";
import { useTodayDate, getTodayISO } from "@/lib/date-sync";

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const Schema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  phase: z.enum(["propagation", "plug", "potted"]),
  supplier_id: z.string().uuid(),
  containers: z.coerce.number().int().min(1),
  supplier_batch_number: z.string().min(1).max(120),
  incoming_date: DateOnly,
  quality_rating: z.coerce.number().int().min(1).max(6).optional(),
  pest_or_disease: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  passport_override: z
    .object({
    operator_reg_no: z.string().optional(),
    origin_country: z.string().optional(),
    traceability_code: z.string().optional(),
    })
    .optional(),
});

type Props = {
  onSubmitSuccess?: (batch: any) => void;
  onCancel?: () => void;
};

const ratingOptions = [
  { value: "6", label: "💯 Perfect" },
  { value: "5", label: "😄 Great" },
  { value: "4", label: "🙂 Good" },
  { value: "3", label: "😐 Fair" },
  { value: "2", label: "😟 Poor" },
  { value: "1", label: "☠️ Reject" },
];

export default function CheckInForm({ onSubmitSuccess, onCancel }: Props) {
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

  // Use hydration-safe date to prevent server/client mismatch
  const today = useTodayDate();

  const form = useForm<CheckInInput>({
    resolver: zodResolver(Schema),
    defaultValues: {
      phase: "propagation",
      containers: 1,
      incoming_date: "", // Empty initially, set after hydration
      quality_rating: 5,
      pest_or_disease: false,
    },
  });

  // Set date after hydration to avoid mismatch
  React.useEffect(() => {
    if (today && !form.getValues("incoming_date")) {
      form.setValue("incoming_date", today);
    }
  }, [today, form]);

  const [submitting, setSubmitting] = React.useState(false);
  const [overrideOn, setOverrideOn] = React.useState(false);
  
  const varieties = React.useMemo(() => referenceData?.varieties ?? [], [referenceData]);
  const sizes = React.useMemo(() => referenceData?.sizes ?? [], [referenceData]);
  const locations = React.useMemo(() => referenceData?.locations ?? [], [referenceData]);
  const suppliers = React.useMemo(() => referenceData?.suppliers ?? [], [referenceData]);

  // Watchers for summary panel
  const watchVariety = form.watch("plant_variety_id");
  const watchSize = form.watch("size_id");
  const watchLocation = form.watch("location_id");
  const watchSupplier = form.watch("supplier_id");
  const watchContainers = Number(form.watch("containers") || 0);
  const watchPhase = form.watch("phase");
  const watchDate = form.watch("incoming_date");

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
  const selectedSupplier = React.useMemo(
    () => suppliers.find((s) => s.id === watchSupplier),
    [suppliers, watchSupplier]
  );

  const totalUnits = selectedSize
    ? watchContainers * Math.max(1, selectedSize.cell_multiple)
    : 0;

  // Material consumption preview data
  const consumptionBatches = React.useMemo(() => {
    if (!watchSize || !selectedSize || totalUnits <= 0) return [];
    return [{
      batchId: 'new-checkin',
      sizeId: watchSize,
      sizeName: selectedSize.name,
      quantity: totalUnits,
    }];
  }, [watchSize, selectedSize, totalUnits]);

  const readyDate = React.useMemo(() => {
    if (!watchDate) return "—";
    const dt = new Date(watchDate);
    dt.setDate(dt.getDate() + 21);
    return dt.toISOString().slice(0, 10);
  }, [watchDate]);

  // Auto-fill passport info when not overriding
  React.useEffect(() => {
    if (!selectedSupplier || overrideOn) return;
    form.setValue("passport_override", {
      operator_reg_no: selectedSupplier.producer_code ?? undefined,
      origin_country: selectedSupplier.country_code ?? undefined,
      traceability_code: form.getValues("passport_override")?.traceability_code ?? undefined,
    });
  }, [selectedSupplier, overrideOn, form]);

  // Defaults for selects once data loads
  React.useEffect(() => {
    if (!form.getValues("plant_variety_id") && varieties.length) {
      form.setValue("plant_variety_id", varieties[0].id);
    }
    if (!form.getValues("size_id") && sizes.length) {
      form.setValue("size_id", sizes[0].id);
    }
    if (!form.getValues("location_id") && locations.length) {
      form.setValue("location_id", locations[0].id);
    }
    if (!form.getValues("supplier_id") && suppliers.length) {
      form.setValue("supplier_id", suppliers[0].id);
    }
  }, [varieties, sizes, locations, suppliers, form]);

  const readiness = [
    { label: "Variety", ok: Boolean(watchVariety) },
    { label: "Size", ok: Boolean(watchSize) },
    { label: "Location", ok: Boolean(watchLocation) },
    { label: "Supplier", ok: Boolean(watchSupplier) },
    { label: "Containers", ok: watchContainers > 0 },
  ];

  async function onSubmit(values: CheckInInput) {
    setSubmitting(true);
    try {
      const { batch } = await ProductionAPI.checkIn(values);
      toast({
        title: "Batch checked in",
        description: `Batch ${batch?.batch_number ?? ""} created`,
      });
      form.reset({
        phase: "propagation",
        containers: 1,
        incoming_date: getTodayISO(),
        quality_rating: 5,
        pest_or_disease: false,
      });
      setOverrideOn(false);
      onSubmitSuccess?.(batch);
    } catch (err) {
      const e = err as HttpError;
      toast({
        title: e.status === 401 ? "Please sign in" : "Failed to check in",
        description: e.requestId ? `${e.message} (ref ${e.requestId})` : e.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (refLoading && !referenceData) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        Loading check-in data…
      </div>
    );
  }

  if (!referenceData) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Reference data unavailable</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{refError ?? "Varieties, sizes, or suppliers are missing."}</span>
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
        className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]"
        noValidate
      >
        <div className="space-y-6">
          <SectionCard
            title="Material & supplier"
            description="Select the incoming variety, container size, and supplier."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                name="plant_variety_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Variety</FormLabel>
                    <VarietyComboboxGrouped
                      varieties={varieties}
                      value={field.value}
                      onSelect={(id) => field.onChange(id)}
                      createHref="/varieties"
                      placeholder="Search varieties..."
                      createLabel="Add new variety"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="size_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Size / Container</FormLabel>
                    <SearchableSelect
                      options={sizes.map((s) => ({
                        value: s.id,
                        label: s.name,
                        description: s.container_type ?? undefined,
                      }))}
                      value={field.value}
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
                name="phase"
                control={form.control}
                render={({ field }) => (
            <FormItem>
                    <FormLabel>Ready phase</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Where will these land?" />
                      </SelectTrigger>
                <SelectContent>
                  <SelectItem value="propagation">Propagation</SelectItem>
                        <SelectItem value="plug">Plug / liner</SelectItem>
                  <SelectItem value="potted">Potted</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
                )}
              />

              <FormField
                name="supplier_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Supplier</FormLabel>
                    <SearchableSelect
                      options={suppliers.map((s) => ({
                        value: s.id,
                        label: s.name,
                        description: s.producer_code ?? undefined,
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      createHref="/suppliers"
                      placeholder="Search suppliers..."
                      createLabel="Add new supplier"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Location & quantities"
            description="Tell us where the intake is staged and how much material arrived."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                name="location_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nursery location</FormLabel>
                    <SearchableSelect
                      options={locations.map((loc) => ({
                        value: loc.id,
                        label: loc.name,
                        description: loc.nursery_site ?? undefined,
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      createHref="/locations"
                      placeholder="Search locations..."
                      createLabel="Add new location"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="incoming_date"
                control={form.control}
                render={({ field }) => (
            <FormItem>
              <FormLabel>Incoming date</FormLabel>
                    <Input type="date" {...field} />
              <FormMessage />
            </FormItem>
                )}
              />

              <FormField
                name="containers"
                control={form.control}
                render={({ field }) => (
            <FormItem>
                    <FormLabel>Containers</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} step={1} {...field} onFocus={(e) => e.target.select()} />
                    </FormControl>
              <FormMessage />
            </FormItem>
                )}
              />

              <FormField
                name="supplier_batch_number"
                control={form.control}
                render={({ field }) => (
           <FormItem>
                    <FormLabel>Supplier batch / traceability</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. PO-2024-09-18" />
                    </FormControl>
             <FormMessage />
           </FormItem>
                )}
              />
            </div>
          </SectionCard>

          <SectionCard title="Quality & passport" description="Capture QC info and overrides.">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                name="quality_rating"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quality rating</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value ? String(field.value) : undefined}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Rate the incoming material" />
                      </SelectTrigger>
                      <SelectContent>
                        {ratingOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="pest_or_disease"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>Pest or disease present?</FormLabel>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(Boolean(v))}
                      />
                      <span className="text-sm text-muted-foreground">
                        Flag if scouts or QC noted anything.
                      </span>
          </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-2 space-y-3 rounded border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Plant passport override</p>
          <p className="text-sm text-muted-foreground">
                      Defaults to supplier registration and origin; toggle to override.
          </p>
                  </div>
                  <Checkbox checked={overrideOn} onCheckedChange={(v) => setOverrideOn(Boolean(v))} />
                </div>
                <div
                  className={`grid gap-3 md:grid-cols-3 ${
                    overrideOn ? "" : "opacity-60"
                  }`}
                >
            <FormField
              name="passport_override.operator_reg_no"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                        <FormLabel>Operator reg. no.</FormLabel>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      disabled={!overrideOn}
                      placeholder={selectedSupplier?.producer_code ?? "Enter producer code"}
                    />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="passport_override.origin_country"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                        <FormLabel>Origin country (ISO)</FormLabel>
                        <Input
                          {...field}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                          disabled={!overrideOn}
                          placeholder={selectedSupplier?.country_code ?? "IE"}
                        />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="passport_override.traceability_code"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                        <FormLabel>Traceability code</FormLabel>
                        <Input
                          {...field}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                          disabled={!overrideOn}
                          placeholder="Overrides supplier batch no."
                        />
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      placeholder="QC observations, storage instructions, etc."
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
            <Button type="submit" disabled={submitting}>
              {submitting ? "Checking in…" : "Check in batch"}
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
              <SummaryRow label="Supplier" value={selectedSupplier?.name ?? "—"} />
              <SummaryRow label="Phase" value={watchPhase} />
              <SummaryRow label="Location" value={selectedLocation?.name ?? "—"} />
              <SummaryRow
                label="Containers"
                value={watchContainers ? watchContainers.toLocaleString() : "—"}
              />
              <SummaryRow
                label="Units"
                value={
                  totalUnits
                    ? `${totalUnits.toLocaleString()} ${totalUnits === 1 ? "plant" : "plants"}`
                    : "—"
                }
              />
              <SummaryRow label="Incoming date" value={watchDate || "—"} />
              <SummaryRow label="Est. ready" value={readyDate} />
            </dl>
          </Card>
          {consumptionBatches.length > 0 && (
            <MaterialConsumptionPreview batches={consumptionBatches} />
          )}
          {refError && (
            <Alert variant="destructive">
              <AlertTitle>Reference data warning</AlertTitle>
              <AlertDescription className="text-sm">
                {refError}. Dropdown options may be incomplete.
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
