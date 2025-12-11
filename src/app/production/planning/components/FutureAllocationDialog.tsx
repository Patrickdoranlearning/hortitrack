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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { fetchJson } from "@/lib/http/fetchJson";
import { useToast } from "@/hooks/use-toast";
import type { ProtocolSummary, PlanningBatch } from "@/lib/planning/types";
import { AlertTriangle, Info, QrCode, AlertCircle } from "lucide-react";
import ScannerDialog from "@/components/scan-and-act-dialog";
import type { FieldErrors } from "react-hook-form";

const OPTIONAL_VALUE = "__option__";

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

// Generate year options (current year + 5 years ahead)
function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => currentYear + i);
}

// Generate week options (1-52)
function getWeekOptions(): number[] {
  return Array.from({ length: 52 }, (_, i) => i + 1);
}

const schema = z
  .object({
    parentBatchId: z.string().optional(),
    plantVarietyId: z.string().optional(),
    sizeId: z.string().min(1, "Size is required"),
    containers: z.preprocess(
      (val) => {
        if (val === "" || val === null || typeof val === "undefined") return undefined;
        const num = Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z.number().int().positive().optional()
    ),
    units: z.preprocess(
      (val) => {
        if (val === "" || val === null || typeof val === "undefined") return undefined;
        const num = Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z.number().int().positive("Units must be positive")
    ),
    targetYear: z.preprocess(
      (val) => {
        if (val === "" || val === null || typeof val === "undefined") return undefined;
        const num = Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z.number().int().min(2024).max(2035)
    ),
    targetWeek: z.preprocess(
      (val) => {
        if (val === "" || val === null || typeof val === "undefined") return undefined;
        const num = Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z.number().int().min(1).max(53)
    ),
    protocolId: z.string().optional(),
    locationId: z.string().optional(),
    label: z.string().max(120).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((value) => Boolean(value.parentBatchId || value.plantVarietyId), {
    message: "Select a parent batch or variety",
    path: ["plantVarietyId"],
  });

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parents: Array<Pick<PlanningBatch, "id" | "batchNumber" | "varietyName" | "varietyId" | "quantity" | "reservedQuantity">>;
  protocols: ProtocolSummary[];
  onSuccess?: () => void;
};

export function FutureAllocationDialog({ open, onOpenChange, parents, protocols, onSuccess }: Props) {
  const { data: refData } = React.useContext(ReferenceDataContext);
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);
  const [isScanOpen, setIsScanOpen] = React.useState(false);

  // Default to current week + 12 weeks ahead
  const now = new Date();
  const futureDate = new Date(now.getTime() + 12 * 7 * 24 * 60 * 60 * 1000);
  const defaultYear = futureDate.getFullYear();
  const defaultWeek = getISOWeek(futureDate);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      parentBatchId: "",
      plantVarietyId: "",
      sizeId: "",
      containers: undefined,
      units: undefined,
      targetYear: defaultYear,
      targetWeek: defaultWeek,
      protocolId: "",
      locationId: "",
      label: "",
      notes: "",
    },
  });

  const sizes = refData?.sizes ?? [];
  const varieties = refData?.varieties ?? [];
  const locations = refData?.locations ?? [];

  // Filter parents to only show those with available stock, and build combobox options
  const parentBatchOptions = React.useMemo<ComboboxOption[]>(() => {
    const options: ComboboxOption[] = [
      { value: OPTIONAL_VALUE, label: "No parent (new batch)" },
    ];
    
    for (const parent of parents) {
      const available = parent.quantity - (parent.reservedQuantity ?? 0);
      // Only include batches with available stock
      if (available <= 0) continue;
      
      const hasReserved = (parent.reservedQuantity ?? 0) > 0;
      const batchLabel = parent.batchNumber ?? parent.id.slice(0, 8);
      const varietyLabel = parent.varietyName ?? "Variety";
      const quantityLabel = hasReserved 
        ? `${available.toLocaleString()} avail (${parent.reservedQuantity?.toLocaleString()} reserved)`
        : `${parent.quantity.toLocaleString()} units`;
      
      options.push({
        value: parent.id,
        label: `${batchLabel} · ${varietyLabel} · ${quantityLabel}`,
      });
    }
    
    return options;
  }, [parents]);

  // Watch fields for calculations
  const watchedParentBatchId = form.watch("parentBatchId");
  const watchedUnits = form.watch("units");
  const watchedSizeId = form.watch("sizeId");
  const watchedContainers = form.watch("containers");
  const hasParent = watchedParentBatchId && watchedParentBatchId !== OPTIONAL_VALUE;
  
  // Get the selected size and its cell multiple
  const selectedSize = sizes.find((s) => s.id === watchedSizeId);
  const cellMultiple = selectedSize?.cell_multiple ?? 1;
  const isTraySize = cellMultiple > 1;
  
  // Keep units in sync with containers for tray sizes
  const updateUnitsFromContainers = React.useCallback(
    (containersValue?: number) => {
      const source = typeof containersValue === "number" ? containersValue : watchedContainers;
      if (!isTraySize) return;

      if (source && source > 0) {
        form.setValue("units", source * cellMultiple, { shouldValidate: true, shouldDirty: true });
      } else {
        form.setValue("units", undefined, { shouldValidate: true, shouldDirty: true });
      }
    },
    [cellMultiple, form, isTraySize, watchedContainers]
  );

  // Recalculate when trays or size change
  React.useEffect(() => {
    updateUnitsFromContainers();
  }, [updateUnitsFromContainers, watchedContainers, cellMultiple, isTraySize]);

  // Get the selected parent's available quantity
  const selectedParent = hasParent ? parents.find((p) => p.id === watchedParentBatchId) : null;
  const availableFromParent = selectedParent 
    ? selectedParent.quantity - (selectedParent.reservedQuantity ?? 0) 
    : null;
  const isOverAllocating = availableFromParent !== null && (watchedUnits ?? 0) > availableFromParent;

  function handleParentChange(batchId: string) {
    const value = batchId === OPTIONAL_VALUE ? "" : batchId;
    form.setValue("parentBatchId", value);
    if (value) {
      const parent = parents.find((p) => p.id === value);
      if (parent?.varietyId) {
        form.setValue("plantVarietyId", parent.varietyId);
      }
    } else {
      // Clear variety when no parent selected
      form.setValue("plantVarietyId", "");
    }
  }

  const handleScanDetected = React.useCallback((code: string) => {
    if (!code) return;
    
    // Try to find a matching batch by batch number or ID
    const matchedParent = parents.find(
      (p) => p.batchNumber === code || p.id === code
    );
    
    if (matchedParent) {
      const available = matchedParent.quantity - (matchedParent.reservedQuantity ?? 0);
      if (available > 0) {
        handleParentChange(matchedParent.id);
        toast({ title: "Batch found", description: `Selected ${matchedParent.batchNumber}` });
      } else {
        toast({ 
          variant: "destructive", 
          title: "No stock available", 
          description: `${matchedParent.batchNumber} has no available stock` 
        });
      }
    } else {
      toast({ 
        variant: "destructive", 
        title: "Batch not found", 
        description: "No matching batch found for scanned code" 
      });
    }
    
    setIsScanOpen(false);
  }, [parents, toast]);

  // Handle validation errors
  function onInvalid(errors: FieldErrors<FormValues>) {
    // Validation failures are expected user input issues; log as a warning with useful detail
    const summarizedErrors = Object.entries(errors).reduce<Record<string, unknown>>(
      (acc, [field, error]) => {
        acc[field] = {
          message: error?.message ?? error?.root?.message ?? null,
          type: (error as any)?.type ?? null,
        };
        return acc;
      },
      {}
    );
    console.warn("[FutureAllocationDialog] Validation failed", {
      errors: summarizedErrors,
      values: form.getValues(),
    });
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
      if (!values.parentBatchId && !values.plantVarietyId) {
        errorMessages.push("Select a parent batch or variety");
      }
      if (!values.sizeId) {
        errorMessages.push("Size is required");
      }
      if (!values.units || values.units <= 0) {
        errorMessages.push("Units must be positive");
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
      const targetReadyDate = getDateFromWeek(values.targetYear!, values.targetWeek!);
      
      await fetchJson("/api/production/batches/planned", {
        method: "POST",
        body: JSON.stringify({
          parentBatchId: values.parentBatchId || undefined,
          plantVarietyId: values.plantVarietyId || undefined,
          sizeId: values.sizeId,
          units: values.units,
          targetReadyDate,
          protocolId: values.protocolId || undefined,
          locationId: values.locationId || undefined,
          label: values.label || undefined,
          notes: values.notes || undefined,
        }),
      });
      toast({ title: "Planned batch saved" });
      onOpenChange(false);
      form.reset({
        parentBatchId: "",
        plantVarietyId: "",
        sizeId: "",
        containers: undefined,
        units: undefined,
        targetYear: defaultYear,
        targetWeek: defaultWeek,
        protocolId: "",
        locationId: "",
        label: "",
        notes: "",
      });
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Failed to save allocation",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !submitting && onOpenChange(value)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Plan Batch</DialogTitle>
          <DialogDescription>
            Assign stock from an existing batch or plan a new batch for future production.
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
                <FormField
                  control={form.control}
                  name="parentBatchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source batch (optional)</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Combobox
                            options={parentBatchOptions}
                            value={field.value || OPTIONAL_VALUE}
                            onChange={(val) => handleParentChange(val)}
                            placeholder="Search by batch # or variety..."
                            emptyMessage="No batches with available stock"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setIsScanOpen(true)}
                          title="Scan batch QR code"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Show available quantity info when parent is selected */}
                {selectedParent && (
                  <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm">
                      <strong>{selectedParent.varietyName}</strong> has{" "}
                      <strong>{availableFromParent?.toLocaleString()}</strong> units available for allocation
                      {(selectedParent.reservedQuantity ?? 0) > 0 && (
                        <span className="text-muted-foreground">
                          {" "}({selectedParent.reservedQuantity?.toLocaleString()} already reserved)
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Only show variety select if no parent batch selected */}
                {!hasParent && (
                  <FormField
                    control={form.control}
                    name="plantVarietyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target variety</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select variety" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {varieties.map((v) => (
                              <SelectItem key={v.id} value={v.id!}>
                                {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Required when not splitting from an existing batch</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="sizeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container / size</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sizes.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                              {s.cell_multiple > 1 && (
                                <span className="text-muted-foreground ml-1">
                                  (×{s.cell_multiple} cells)
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedSize && isTraySize && (
                        <FormDescription>
                          Tray with {cellMultiple} cells per tray
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Show containers field for tray sizes */}
                  {isTraySize ? (
                    <FormField
                      control={form.control}
                      name="containers"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>No. of trays</FormLabel>
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
                          <FormDescription>
                            {watchedContainers && watchedContainers > 0
                              ? `${watchedContainers} trays × ${cellMultiple} cells = ${(watchedContainers * cellMultiple).toLocaleString()} plants`
                              : "Enter number of trays to calculate total plants"
                            }
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div /> // Empty space for grid alignment
                  )}
                  <FormField
                    control={form.control}
                    name="units"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total plants</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={availableFromParent ?? undefined}
                            readOnly={isTraySize}
                            className={`${isOverAllocating ? "border-amber-500" : ""} ${isTraySize ? "bg-muted" : ""}`}
                            {...field} 
                            value={field.value ?? ""} 
                            onChange={(e) => {
                              if (!isTraySize) {
                                field.onChange(e.target.value === "" ? undefined : Number(e.target.value));
                              }
                            }}
                          />
                        </FormControl>
                        {availableFromParent !== null && (
                          <FormDescription className={isOverAllocating ? "text-amber-600" : ""}>
                            {isOverAllocating 
                              ? `⚠️ Exceeds available (${availableFromParent.toLocaleString()} max)`
                              : `Max available: ${availableFromParent.toLocaleString()}`
                            }
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Over-allocation warning */}
                {isOverAllocating && (
                  <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm">
                      You're planning <strong>{((watchedUnits ?? 0) - (availableFromParent ?? 0)).toLocaleString()}</strong> more 
                      units than currently available. The save will fail if the parent doesn't have enough stock.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Target week/year */}
                <div className="space-y-2">
                  <FormLabel>Target ready week</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="targetWeek"
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
                            <SelectContent>
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
                      name="targetYear"
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
                    Plan by week number — much easier to target than specific dates
                  </FormDescription>
                </div>

                <FormField
                  control={form.control}
                  name="protocolId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipe / protocol</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === OPTIONAL_VALUE ? "" : value)}
                        value={field.value ?? OPTIONAL_VALUE}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Optional protocol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={OPTIONAL_VALUE}>No protocol</SelectItem>
                          {protocols.map((protocol) => (
                            <SelectItem key={protocol.id} value={protocol.id}>
                              {protocol.name}
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
                      <FormLabel>Planning location</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === OPTIONAL_VALUE ? "" : value)}
                        value={field.value ?? OPTIONAL_VALUE}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Auto (Planning Backlog)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={OPTIONAL_VALUE}>Auto</SelectItem>
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
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label / customer (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Spring 2027 – Kramer Red" {...field} />
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
                        <Textarea rows={3} placeholder="Internal commentary" {...field} />
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
                {submitting ? "Planning..." : "Save plan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        <ScannerDialog
          open={isScanOpen}
          onOpenChange={setIsScanOpen}
          onDetected={handleScanDetected}
        />
      </DialogContent>
    </Dialog>
  );
}

