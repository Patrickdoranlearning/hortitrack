
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { postJson } from "@/lib/net";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";

function compactPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === undefined || v === null) continue; // drop empties
    out[k] = v;
  }
  return out as Partial<T>;
}

const formSchema = (maxQuantity: number) => z.object({
  plantingDate: z.date({ required_error: "Transplant date is required" }),
  size: z.string().min(1, "Size is required"),
  locationId: z.string().optional(),
  location: z.string().optional(),
  trayQuantity: z.coerce.number().int().nonnegative().optional(),
  quantity: z.coerce.number().int().positive().max(maxQuantity, `Max ${maxQuantity}`),
  logRemainingAsLoss: z.boolean().default(false),
  notes: z.string().optional(),
}).refine(
  (v) => !!v.locationId || !!v.location,
  { path: ["locationId"], message: "Select a destination" }
);

type FormData = z.infer<ReturnType<typeof formSchema>>;

type Props = {
  batch: Batch;
  nurseryLocations: NurseryLocation[];
  plantSizes: PlantSize[];
  onCancel: () => void;
  onSuccess?: (newBatch: { batchId: string; batchNumber: string }) => void;
};

export function TransplantForm({
  batch, nurseryLocations, plantSizes, onCancel, onSuccess,
}: Props) {
  const { toast } = useToast();
  const [selectedSize, setSelectedSize] = useState<PlantSize | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // default quantity = full batch until trays/size says otherwise
  const defaultQty = batch.quantity ?? 0;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema(defaultQty)),
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
    } else {
      // if user hasn’t typed anything, keep full batch by default
      const current = form.getValues("quantity");
      if (!current || current <= 0) {
        form.setValue("quantity", defaultQty, { shouldValidate: true });
      }
    }
  }, [form, selectedSize, defaultQty, form.watch("trayQuantity")]);

  const sortedPlantSizes = useMemo(() => {
    // Example sort by size string; adjust to your preference
    return [...(plantSizes || [])].sort((a, b) =>
      String(a.size).localeCompare(String(b.size))
    );
  }, [plantSizes]);

  function idemKey(values: FormData) {
    const key = [
      batch.id || batch.batchNumber,
      values.size,
      values.locationId || values.location || "",
      values.quantity,
      values.plantingDate.getTime(),
    ].join(":");
    // very simple hash
    return typeof window === "undefined" ? key : window.btoa(unescape(encodeURIComponent(key))).slice(0, 128);
  }

  async function onSubmit(values: FormData) {
    if (!batch) return;
    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const payload = {
      plantingDate: values.plantingDate.toISOString(),
      quantity: values.quantity ?? defaultQty,
      size: values.size,
      locationId: values.locationId,
      location: values.location,
      logRemainingAsLoss: values.logRemainingAsLoss,
      notes: values.notes,
    };

    const batchKey = batch.id ?? batch.batchNumber;
    const url = `/api/batches/${encodeURIComponent(String(batchKey))}/transplant`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idemKey(values),
        },
        body: JSON.stringify(compactPayload(payload)),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j?.issues && Array.isArray(j.issues)) {
          for (const iss of j.issues) {
            const p = String(iss.path || "");
            if (p === "size") form.setError("size", { message: iss.message });
            if (p === "quantity") form.setError("quantity", { message: iss.message });
            if (p.startsWith("location")) form.setError("locationId", { message: iss.message });
            if (p === "plantingDate") form.setError("plantingDate", { message: iss.message });
          }
        }
        const msg = j?.error || "Invalid input";
        toast({ variant: "destructive", title: "Transplant failed", description: String(msg) });
        return;
      }

      const j = await res.json();
      toast({ title: "Transplant created", description: `New batch ${j?.newBatch?.batchNumber}` });
      onSuccess?.(j.newBatch);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Network error", description: String(e?.message || e) });
    }
  }

  return (
    <>
    <DialogHeader>
        <DialogTitle className="font-headline text-2xl">
          Transplant Batch
        </DialogTitle>
        <DialogDescription>
          Create a new batch from existing batch #{batch?.batchNumber}.
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
                      <Input readOnly className="bg-muted" type="number" value={field.value ?? ""} />
                    </FormControl>
                    <FormDescription>Max available: {batch.quantity}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={form.formState.isSubmitting}>
            Cancel
          </Button>
          <SubmitButton pending={form.formState.isSubmitting}>
            Create Transplanted Batch
          </SubmitButton>
        </DialogFooter>
      </form>
    </Form>
    </>
  );
}
