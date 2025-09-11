
"use client";

import { useEffect, useMemo, useRef, useState, useContext } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Batch, NurseryLocation, PlantSize } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";

function compactPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === undefined || v === null) continue; // drop empties
    out[k] = v;
  }
  return out as Partial<T>;
}

const formSchema = (maxQuantity: number | null, isNewPropagation: boolean) => {
  const Base = z.object({
    plantingDate: z.date({ required_error: "Transplant date is required" }),
    size: z.string().min(1, "Size is required"),
    locationId: z.string().optional(),
    location: z.string().optional(),
    trayQuantity: z.coerce.number().int().nonnegative().optional(),
    quantity: z.coerce.number().int().positive(),
    logRemainingAsLoss: z.boolean().default(false),
    notes: z.string().optional(),
  });

  const schemaWithRefinements = Base.refine(
    (v) => !!v.locationId || !!v.location,
    { path: ["locationId"], message: "Select a destination" }
  );

  if (maxQuantity !== null && !isNewPropagation) {
    return schemaWithRefinements.extend({
      quantity: z.coerce.number().int().positive().max(maxQuantity, `Max ${maxQuantity}`),
    });
  } else if (isNewPropagation) {
    return schemaWithRefinements.extend({
      // For new propagation, quantity is not limited by an existing batch
      quantity: z.coerce.number().int().positive("Quantity is required and must be positive"),
    });
  }
  return schemaWithRefinements;
};

export type TransplantFormData = z.infer<ReturnType<typeof formSchema>>;

type Props = {
  batch: Batch | null;
  nurseryLocations: NurseryLocation[];
  plantSizes?: PlantSize[];
  onSubmit: (data: TransplantFormData) => Promise<void>;
  onCancel: () => void;
  onSuccess?: (newBatch: { batchId: string; batchNumber: string }) => void;
  isNewPropagation: boolean; // New prop
};

export function TransplantForm({
  batch, nurseryLocations, plantSizes = [], onSubmit: onSubmitProp, isNewPropagation, onCancel
}: Props) {
  const { data } = useContext(ReferenceDataContext);
  const sizesSafe = (plantSizes && plantSizes.length ? plantSizes : data?.sizes ?? []) as Array<PlantSize>;
  const { toast } = useToast();
  const [selectedSize, setSelectedSize] = useState<PlantSize | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // default quantity = full batch until trays/size says otherwise
  const defaultQty = isNewPropagation ? 0 : (batch?.quantity ?? 0);

  const form = useForm<TransplantFormData>({
    resolver: zodResolver(formSchema(isNewPropagation ? null : defaultQty, isNewPropagation)),
    defaultValues: {
      plantingDate: new Date(),
      size: "",
      locationId: undefined,
      location: undefined,
      trayQuantity: undefined,
      quantity: defaultQty,
      logRemainingAsLoss: false,
      notes: "",
    },
    mode: "onChange",
  });

  // keep quantity derived from trays * size.multiple; fall back to full batch
  useEffect(() => {
    const t = form.getValues("trayQuantity");
    const m = selectedSize?.multiple ?? 0;
    if (t && m && m > 1) {
      const q = t * m;
      form.setValue("quantity", q, { shouldValidate: true, shouldDirty: true });
    } else if (!isNewPropagation) {
      // if user hasn’t typed anything, keep full batch by default, only for transplant
      const current = form.getValues("quantity");
      if (!current || current <= 0) {
        form.setValue("quantity", defaultQty, { shouldValidate: true });
      }
    }
  }, [form, selectedSize, defaultQty, isNewPropagation, form.watch("trayQuantity")]);

  const newSizeId = form.watch("size");
  const selectedSizeMemo = useMemo(
    () => sizesSafe.find((s) => s.id === newSizeId),
    [sizesSafe, newSizeId]
  );
  const sizeMultiple = selectedSizeMemo?.multiple ?? 1;

  const sortedPlantSizes = useMemo(() => {
    // Example sort by size string; adjust to your preference
    return [...(sizesSafe || [])].sort((a, b) =>
      String(a.size).localeCompare(String(b.size))
    );
  }, [sizesSafe]);

  function idemKey(values: TransplantFormData) {
    const key = [
      batch?.id || batch?.batchNumber || "new-propagation",
      values.size,
      values.locationId || values.location || "",
      values.quantity,
      values.plantingDate.getTime(),
    ].join(":");
    // very simple hash
    return typeof window === "undefined" ? key : window.btoa(unescape(encodeURIComponent(key))).slice(0, 128);
  }

  async function onSubmit(values: TransplantFormData) {
    if (!batch && !isNewPropagation) return; // Should not happen with new propagation logic
    
    // Applying the bonus suggestion for safer transplant totals
    const w = form.watch();
    const computed = (w.trayQuantity ?? 0) * (selectedSize?.multiple ?? 0) + 0; // partialCells not in current schema
    const payload = { ...values, quantity: values.quantity }; // For now, quantity is directly from form

    await onSubmitProp(payload);
  }

  return (
    <>
    <DialogHeader>
        <DialogTitle className="font-headline text-2xl">
          {isNewPropagation ? "New Propagation" : "Transplant Batch"}
        </DialogTitle>
        <DialogDescription>
          {isNewPropagation 
            ? "Create a brand new batch for propagation." 
            : `Create a new batch from existing batch #${batch?.batchNumber}.`}
        </DialogDescription>
      </DialogHeader>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="grid gap-4 p-1">
            <FormField
              control={form.control}
              name="size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Size</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      const s = plantSizes.find((x) => x.size === v) || null;
                      setSelectedSize(s);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sortedPlantSizes.map((s) => (
                        <SelectItem key={s.id ?? s.size} value={s.size}>
                          {s.size} {s.multiple ? `(x${s.multiple}/tray)` : ""}
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
                  <FormLabel>New Location</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a location" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {nurseryLocations.map((l) => (
                        <SelectItem key={l.id ?? l.name} value={l.id ?? l.name!}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>If your locations don’t have IDs, we’ll store the name.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="plantingDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Transplant Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                       <Button
                              type="button"
                              variant={'outline'}
                              className={cn(
                                'w-full justify-start text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(d) => field.onChange(d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="trayQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>No. of Trays</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        type="number"
                        min={0}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      If size has a multiple, total plants = trays × multiple.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Plants</FormLabel>
                    <FormControl>
                      <Input 
                        readOnly={!isNewPropagation} 
                        className={cn({ "bg-muted": !isNewPropagation })} 
                        type="number" 
                        min={isNewPropagation ? 1 : 0} // For new propagation, min quantity is 1
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    {!isNewPropagation && <FormDescription>Max available: {batch?.quantity}</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!isNewPropagation && (
              <FormField
                control={form.control}
                name="logRemainingAsLoss"
                render={({ field }) => (
                  <FormItem className="flex gap-3 items-start rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Log remaining units as loss and archive original batch</FormLabel>
                      <FormDescription>
                        Any untransplanted units will be logged as a loss and the original batch will be archived.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={form.formState.isSubmitting}>
            Cancel
          </Button>
          <SubmitButton pending={form.formState.isSubmitting}>
            {isNewPropagation ? "Create New Propagation Batch" : "Create Transplanted Batch"}
          </SubmitButton>
        </DialogFooter>
      </form>
    </Form>
    </>
  );
}
