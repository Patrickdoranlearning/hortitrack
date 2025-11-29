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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const sizes = React.useMemo(() => referenceData?.sizes ?? [], [referenceData]);
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
      console.error("[PropagationForm] submit error", e);
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
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                name="plant_variety_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
            <FormLabel>Variety</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Search or pick a variety" />
                      </SelectTrigger>
              <SelectContent>
                        {varieties.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                            {v.name}
                            {v.family ? ` · ${v.family}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
                )}
              />

              <div>
                <FormLabel>Family (auto)</FormLabel>
                <Input value={selectedVariety?.family ?? ""} readOnly />
                <p className="mt-1 text-xs text-muted-foreground">
                  Edit varieties in Settings → Varieties.
                </p>
              </div>

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
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                name="size_id"
                control={form.control}
                render={({ field }) => (
          <FormItem>
                    <FormLabel>Size / Container</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a size" />
                      </SelectTrigger>
              <SelectContent>
                        {sizes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                            {s.name}
                            {s.container_type ? ` · ${s.container_type}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
                )}
              />

              <div>
                <FormLabel>Cells per container</FormLabel>
                <Input
                  readOnly
                  value={selectedSize?.cell_multiple ?? "—"}
                  className="bg-muted text-muted-foreground"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Derived from the selected tray definition.
                </p>
              </div>

              <FormField
                name="containers"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Containers (trays or pots)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} step={1} {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a bench or tunnel" />
                      </SelectTrigger>
              <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.nursery_site ? `${loc.nursery_site} · ` : ""}
                            {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
