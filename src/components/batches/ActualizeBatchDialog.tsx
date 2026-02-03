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
import { SelectWithCreate } from "../ui/select-with-create";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { fetchJson } from "@/lib/http/fetchJson";
import { useToast } from "@/hooks/use-toast";
import { invalidateBatches } from "@/lib/swr/keys";
import type { Batch } from "@/lib/types";
import { Info, AlertTriangle } from "lucide-react";
import { useTodayDate, getTodayISO } from "@/lib/date-sync";

const schema = z.object({
  quantity: z.preprocess(
    (val) => (val === "" || val === null ? undefined : Number(val)),
    z.number().int().positive("Quantity must be positive")
  ),
  locationId: z.string().min(1, "Location is required"),
  status: z.string().min(1, "Status is required"),
  plantedAt: z.string().min(1, "Date is required"),
  notes: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch;
  onSuccess?: () => void;
};

export function ActualizeBatchDialog({ open, onOpenChange, batch, onSuccess }: Props) {
  const { data: refData, reload } = React.useContext(ReferenceDataContext);
  const { toast } = useToast();

  // Auto-refresh reference data when user returns from creating a new entity in another tab
  useRefreshOnFocus(reload);
  const [submitting, setSubmitting] = React.useState(false);

  // Use hydration-safe date to prevent server/client mismatch
  const today = useTodayDate();

  const isIncoming = batch.status === "Incoming";
  const isPlanned = batch.status === "Planned";

  // Determine default status based on batch type
  const getDefaultStatus = () => {
    if (isIncoming) return "Potted"; // Incoming stock typically arrives potted
    // For planned batches, try to infer from the size name
    const sizeName = typeof batch.size === "string" ? batch.size : (batch.size as any)?.name ?? "";
    if (sizeName.toLowerCase().includes("plug") || sizeName.toLowerCase().includes("liner")) {
      return "Plugs/Liners";
    }
    if (sizeName.toLowerCase().includes("prop") || sizeName.toLowerCase().includes("cutting")) {
      return "Propagation";
    }
    return "Potted";
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      quantity: batch.quantity ?? 0,
      locationId: "",
      status: getDefaultStatus(),
      plantedAt: "", // Empty initially, set after hydration
      notes: "",
    },
  });

  // Reset form when batch changes or dialog opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        quantity: batch.quantity ?? 0,
        locationId: "",
        status: getDefaultStatus(),
        plantedAt: getTodayISO(),
        notes: "",
      });
    }
  }, [batch.id, open]);

  // Set date after hydration when dialog first opens
  React.useEffect(() => {
    if (today && !form.getValues("plantedAt")) {
      form.setValue("plantedAt", today);
    }
  }, [today, form]);

  const locations = refData?.locations ?? [];
  // Filter out virtual locations
  const realLocations = locations.filter(
    (loc) => !loc.name?.includes("Transit") && !loc.name?.includes("Planning")
  );

  const statusOptions = [
    { value: "Propagation", label: "Propagation" },
    { value: "Plugs/Liners", label: "Plugs / Liners" },
    { value: "Potted", label: "Potted" },
    { value: "Looking Good", label: "Looking Good" },
    { value: "Ready for Sale", label: "Ready for Sale" },
  ];

  const plannedQuantity = batch.quantity ?? 0;
  const watchedQuantity = form.watch("quantity");
  const quantityDiff = (watchedQuantity ?? 0) - plannedQuantity;

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await fetchJson(`/api/batches/${batch.id}/actualize`, {
        method: "POST",
        body: JSON.stringify({
          quantity: values.quantity,
          locationId: values.locationId,
          status: values.status,
          plantedAt: values.plantedAt,
          notes: values.notes,
        }),
      });

      toast({
        title: isIncoming ? "Stock received" : "Batch actualized",
        description: `${batch.batchNumber} is now in active production.`,
      });
      // Invalidate batch caches to trigger refresh across all components
      invalidateBatches();
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Failed to actualize batch",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !submitting && onOpenChange(value)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">
            {isIncoming ? "Receive Incoming Stock" : "Actualize Planned Batch"}
          </DialogTitle>
          <DialogDescription>
            {isIncoming
              ? `Confirm receipt of ${batch.batchNumber} and start production.`
              : `Convert planned batch ${batch.batchNumber} to active production.`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="flex-1 flex flex-col overflow-hidden" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid gap-4 p-1">
                {/* Info banner */}
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm">
                    <strong>Planned:</strong> {plannedQuantity.toLocaleString()} {batch.plantVariety ?? "units"}
                    {batch.size && (
                      <span className="ml-2">
                        • Target: {typeof batch.size === "string" ? batch.size : (batch.size as any)?.name}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual quantity</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} value={field.value ?? ""} onFocus={(e) => e.target.select()} />
                      </FormControl>
                      <FormDescription>
                        {quantityDiff === 0 ? (
                          "Matches planned quantity"
                        ) : quantityDiff > 0 ? (
                          <span className="text-green-600">+{quantityDiff.toLocaleString()} more than planned</span>
                        ) : (
                          <span className="text-amber-600">{quantityDiff.toLocaleString()} fewer than planned</span>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to location</FormLabel>
                      <SelectWithCreate
                        options={realLocations.map((loc) => ({
                          value: loc.id!,
                          label: (loc.nursery_site ? `${loc.nursery_site} · ` : "") + loc.name,
                        }))}
                        value={field.value}
                        onValueChange={field.onChange}
                        createHref="/locations"
                        placeholder="Select production location"
                        createLabel="Add new location"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Production status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
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
                    name="plantedAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isIncoming ? "Received date" : "Started date"}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder={isIncoming ? "Delivery notes, condition..." : "Any adjustments from plan..."}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {quantityDiff !== 0 && (
                  <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm">
                      The quantity differs from the plan. This will be logged as an adjustment.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <DialogFooter className="border-t pt-4 mt-4">
              <Button type="button" variant="ghost" disabled={submitting} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Processing..."
                  : isIncoming
                  ? "Receive & Start Production"
                  : "Actualize Batch"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}







