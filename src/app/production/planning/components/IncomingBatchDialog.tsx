"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { fetchJson } from "@/lib/http/fetchJson";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import type { FieldErrors } from "react-hook-form";

// Helper to get ISO week number from a date
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper to get the Monday of a given ISO week
function getDateFromWeek(year: number, week: number): string {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const isoWeekStart = simple;
  if (dow <= 4) {
    isoWeekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    isoWeekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }
  return isoWeekStart.toISOString().slice(0, 10);
}

// Generate year options (current year + 3 years ahead for incoming)
function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 4 }, (_, i) => currentYear + i);
}

// Generate week options (1-52)
function getWeekOptions(): number[] {
  return Array.from({ length: 52 }, (_, i) => i + 1);
}

const formSchema = z
  .object({
    plantVarietyId: z.string().min(1, "Variety is required"),
    sizeId: z.string().min(1, "Size is required"),
    supplierId: z.string().optional(),
    units: z
      .preprocess((val) => {
        if (val === "" || val === null || typeof val === "undefined") return undefined;
        const num = Number(val);
        return Number.isNaN(num) ? undefined : num;
      }, z.number().int().positive())
      .optional(),
    containers: z
      .preprocess((val) => {
        if (val === "" || val === null || typeof val === "undefined") return undefined;
        const num = Number(val);
        return Number.isNaN(num) ? undefined : num;
      }, z.number().int().positive())
      .optional(),
    expectedYear: z.preprocess(
      (val) => {
        if (val === "" || val === null || typeof val === "undefined") return undefined;
        const num = Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z.number().int().min(2024).max(2035)
    ),
    expectedWeek: z.preprocess(
      (val) => {
        if (val === "" || val === null || typeof val === "undefined") return undefined;
        const num = Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z.number().int().min(1).max(53)
    ),
    reference: z.string().max(120).optional(),
    notes: z.string().max(1000).optional(),
    locationId: z.string().optional(),
  })
  .refine((value) => value.units || value.containers, {
    message: "Provide units or containers",
    path: ["units"],
  });

const OPTIONAL_SELECT_VALUE = "__optional__";

type FormValues = z.infer<typeof formSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function IncomingBatchDialog({ open, onOpenChange, onSuccess }: Props) {
  const { data: refData } = React.useContext(ReferenceDataContext);
  const { toast } = useToast();

  // Default to current week + 4 weeks ahead for incoming stock
  const now = new Date();
  const futureDate = new Date(now.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
  const defaultYear = futureDate.getFullYear();
  const defaultWeek = getISOWeek(futureDate);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plantVarietyId: "",
      sizeId: "",
      supplierId: undefined,
      units: undefined,
      containers: undefined,
      expectedYear: defaultYear,
      expectedWeek: defaultWeek,
      reference: "",
      notes: "",
      locationId: undefined,
    },
  });

  const [submitting, setSubmitting] = React.useState(false);

  // Handle validation errors
  function onInvalid(errors: FieldErrors<FormValues>) {
    console.error("[IncomingBatchDialog] Validation failed:", errors);
    // Show toast for validation errors
    const errorMessages: string[] = [];
    
    // Check each field for errors
    Object.entries(errors).forEach(([field, error]) => {
      if (error?.message) {
        errorMessages.push(String(error.message));
      } else if (error?.root?.message) {
        // Handle nested root errors from refinements
        errorMessages.push(String(error.root.message));
      }
    });
    
    // If no specific errors but validation failed, do a manual check
    if (errorMessages.length === 0) {
      const values = form.getValues();
      if (!values.plantVarietyId) {
        errorMessages.push("Variety is required");
      }
      if (!values.sizeId) {
        errorMessages.push("Size is required");
      }
      if (!values.units && !values.containers) {
        errorMessages.push("Provide units or containers");
      }
    }
    
    if (errorMessages.length > 0) {
      toast({
        title: "Please fix form errors",
        description: errorMessages.join(". "),
        variant: "destructive",
      });
    } else {
      // Fallback message if we still can't determine the error
      toast({
        title: "Form validation failed",
        description: "Please check all required fields are filled in correctly.",
        variant: "destructive",
      });
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      // Convert week/year to a date for the API
      const expectedDate = getDateFromWeek(values.expectedYear!, values.expectedWeek!);
      
      await fetchJson("/api/production/batches/incoming", {
        method: "POST",
        body: JSON.stringify({
          plantVarietyId: values.plantVarietyId,
          sizeId: values.sizeId,
          supplierId: values.supplierId || undefined,
          units: values.units,
          containers: values.containers,
          expectedDate,
          locationId: values.locationId || undefined,
          reference: values.reference || undefined,
          notes: values.notes || undefined,
        }),
      });
      toast({ title: "Incoming batch captured" });
      form.reset({
        plantVarietyId: "",
        sizeId: "",
        supplierId: undefined,
        units: undefined,
        containers: undefined,
        expectedYear: defaultYear,
        expectedWeek: defaultWeek,
        reference: "",
        notes: "",
        locationId: undefined,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Failed to save",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const varieties = refData?.varieties ?? [];
  const sizes = refData?.sizes ?? [];
  const suppliers = refData?.suppliers ?? [];
  const locations = refData?.locations ?? [];

  // Auto-calc units from trays when size has a cell multiple
  const watchedSizeId = form.watch("sizeId");
  const watchedContainers = form.watch("containers");
  const selectedSize = sizes.find((s) => s.id === watchedSizeId);
  const cellMultiple = selectedSize?.cell_multiple ?? 1;
  const isTraySize = cellMultiple > 1;

  const updateUnitsFromContainers = React.useCallback(
    (containersValue?: number) => {
      if (!isTraySize) return;
      const source = typeof containersValue === "number" ? containersValue : watchedContainers;
      if (source && source > 0) {
        form.setValue("units", source * cellMultiple, { shouldValidate: true, shouldDirty: true });
      } else {
        form.setValue("units", undefined, { shouldValidate: true, shouldDirty: true });
      }
    },
    [cellMultiple, form, isTraySize, watchedContainers]
  );

  React.useEffect(() => {
    updateUnitsFromContainers();
  }, [updateUnitsFromContainers, watchedContainers, cellMultiple, isTraySize]);

  return (
    <Dialog open={open} onOpenChange={(value) => !submitting && onOpenChange(value)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Incoming / Ghost Batch</DialogTitle>
          <DialogDescription>
            Plan stock arriving from suppliers before it reaches the nursery.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="flex-1 flex flex-col overflow-hidden" onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid gap-4 p-1">
                {/* Form-level validation errors */}
                {Object.keys(form.formState.errors).length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {Object.entries(form.formState.errors).map(([field, error]) => (
                        <div key={field}>{error?.message ? String(error.message) : `Invalid ${field}`}</div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="plantVarietyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Variety</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select variety" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {varieties.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name}
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
                    name="sizeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {sizes.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="containers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cells</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const next = e.target.value === "" ? undefined : Number(e.target.value);
                              field.onChange(next);
                              updateUnitsFromContainers(next);
                            }}
                          />
                        </FormControl>
                        {isTraySize && (
                          <FormDescription>
                            {watchedContainers && watchedContainers > 0
                              ? `${watchedContainers} × ${cellMultiple} cells = ${(watchedContainers * cellMultiple).toLocaleString()} units`
                              : "Enter number of trays to calculate total units"}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="units"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total units</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            readOnly={isTraySize}
                            className={isTraySize ? "bg-muted" : ""}
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              if (!isTraySize) {
                                const next = e.target.value === "" ? undefined : Number(e.target.value);
                                field.onChange(next);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Expected arrival week */}
                <div className="space-y-2">
                  <FormLabel>Expected arrival week</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="expectedWeek"
                      render={({ field }) => (
                        <FormItem>
                          <Select
                            onValueChange={(val) => field.onChange(Number(val))}
                            value={field.value?.toString() ?? ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Week" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[300px]">
                              {getWeekOptions().map((week) => (
                                <SelectItem key={week} value={week.toString()}>
                                  Week {week}
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
                      name="expectedYear"
                      render={({ field }) => (
                        <FormItem>
                          <Select
                            onValueChange={(val) => field.onChange(Number(val))}
                            value={field.value?.toString() ?? ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Year" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {getYearOptions().map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormDescription className="text-xs">
                    When do you expect this delivery to arrive?
                  </FormDescription>
                </div>

                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === OPTIONAL_SELECT_VALUE ? undefined : value)}
                        value={field.value ?? OPTIONAL_SELECT_VALUE}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Optional supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value={OPTIONAL_SELECT_VALUE}>Not set</SelectItem>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
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
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Landing location</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === OPTIONAL_SELECT_VALUE ? undefined : value)}
                        value={field.value ?? OPTIONAL_SELECT_VALUE}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Use virtual Transit location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value={OPTIONAL_SELECT_VALUE}>Auto (Transit - Incoming)</SelectItem>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
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
                  control={form.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier reference</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. PO-12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="Optional context" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="border-t pt-4 mt-4">
              <Button type="button" variant="ghost" disabled={submitting} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save incoming batch"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

