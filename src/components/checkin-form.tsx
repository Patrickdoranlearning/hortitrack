// src/components/checkin-form.tsx
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckinFormSchema, CheckinFormInput } from "@/types/batch";
import { calcUnitsFromContainers } from "@/lib/quantity";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlantVariety } from "@/lib/varieties";
import { getVarieties } from "@/lib/varieties"; // Assuming this function exists

type CheckinFormProps = {
  onSubmit: (data: CheckinFormInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
};

export function CheckinForm({ onSubmit, onCancel, isLoading, error }: CheckinFormProps) {
  const [varieties, setVarieties] = useState<PlantVariety[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function fetchVarieties() {
      const fetchedVarieties = await getVarieties();
      setVarieties(fetchedVarieties);
    }
    fetchVarieties();
  }, []);

  const form = useForm<CheckinFormInput>({
    resolver: zodResolver(CheckinFormSchema),
    defaultValues: {
      variety: "",
      sizeId: "", // This will be set by the dialog/parent
      sizeMultiple: 1,
      phase: "Potted",
      containers: 0,
      totalUnits: 0,
      overrideTotal: false,
      locationId: "T21", // This will be set by the dialog/parent
      incomingDate: new Date().toISOString().slice(0, 10),
      supplierId: "", // This will be set by the dialog/parent
      passportA: "",
      passportB: "",
      passportC: "",
      passportD: "IE",
      photos: [],
    },
    mode: "onChange",
  });

  const w = form.watch();
  const computedTotal = calcUnitsFromContainers(w.containers || 0, w.sizeMultiple || 1);

  // Update computedTotal when containers or sizeMultiple changes
  useEffect(() => {
    if (!w.overrideTotal) {
      form.setValue("totalUnits", computedTotal, { shouldValidate: true });
    }
  }, [w.containers, w.sizeMultiple, w.overrideTotal, computedTotal, form]);

  const handleVarietyChange = (selectedValue: string) => {
    const selectedVariety = varieties.find(
      (variety) => variety.variety === selectedValue
    );
    if (selectedVariety) {
      form.setValue("variety", selectedVariety.variety, { shouldValidate: true });
      form.setValue("passportA", selectedVariety.family ?? "", { shouldValidate: true }); // Auto-fill family
    } else {
      form.setValue("variety", selectedValue, { shouldValidate: true });
      form.setValue("passportA", "", { shouldValidate: true }); // Clear family if not found
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <FormField
          control={form.control}
          name="variety"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Variety</FormLabel>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value
                        ? varieties.find((variety) => variety.variety === field.value)?.variety
                        : "Select variety"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search variety..." />
                    <CommandList>
                      <CommandEmpty>No variety found.</CommandEmpty>
                      <CommandGroup>
                        {varieties.map((variety) => (
                          <CommandItem
                            value={variety.variety}
                            key={variety.variety}
                            onSelect={() => {
                              handleVarietyChange(variety.variety);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                variety.variety === field.value
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {variety.variety}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormDescription>
                This is the plant variety that will be checked in.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-4 gap-3">
          <FormField
            control={form.control}
            name="sizeMultiple"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Size Multiple</FormLabel>
                <FormControl>
                  <Input type="number" min={1} {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="containers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Containers</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="totalUnits"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Units</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    disabled={!w.overrideTotal}
                    {...field}
                    onChange={e => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="overrideTotal"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-start space-x-2 rounded-lg border p-3 shadow-sm col-span-1">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-0.5">
                  <FormLabel>Manual Override</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>

        {!w.overrideTotal ? (
          <div className="text-sm text-muted-foreground">
            Total Units (auto): <span className="font-medium">{computedTotal}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="locationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="incomingDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Incoming Date</FormLabel>
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
          name="supplierId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Supplier</FormLabel>
              <FormControl>
                <Input {...field} placeholder="supplier doc id" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="mt-2 border rounded p-3">
          <div className="font-medium mb-2">Supplier Plant Passport</div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="passportA"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>A Family</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passportB"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>B Producer Code</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passportC"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>C Supplier Batch No.</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passportD"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>D Country Code</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Batch"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
