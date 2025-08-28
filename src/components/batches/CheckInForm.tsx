"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Star, Trash2 } from "lucide-react";
import { VarietyCombobox, type VarietyOption } from "@/components/ui/variety-combobox";
import { format } from "date-fns";
import type {
  NurseryLocation, PlantSize, Supplier, Variety,
} from "@/lib/types";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SafeSelect } from '@/components/ui/SafeSelect';
import { normalizeOptions, type Option } from '@/lib/options';
import { useActiveOrg } from "@/server/org/context";
import { useToast } from "@/hooks/use-toast";
import {
  searchVarieties,
  searchSizes,
  searchLocations,
  searchSuppliers,
} from '@/server/refdata/queries';
import { cn } from "@/lib/utils";

// Zod schema for CheckinForm input
const CheckinFormSchema = z.object({
  varietyId: z.string().uuid({ message: "Variety is required." }),
  sizeId: z.string().uuid({ message: "Size is required." }),
  locationId: z.string().uuid({ message: "Location is required." }),
  phase: z.enum(["propagation", "plug_linear", "potted"], { required_error: "Phase is required." }),
  containers: z.coerce.number().int().positive({ message: "Number of containers must be positive." }),
  totalUnits: z.coerce.number().int().positive().optional(),
  overrideTotal: z.boolean().default(false),
  incomingDate: z.date({ required_error: "Incoming date is required." }),
  supplierId: z.string().uuid().nullable().optional(),
  supplierBatchNumber: z.string().min(1, "Supplier Batch # is required."),
  photos: z.array(z.string().url()).max(3, "Maximum 3 photos.").optional().default([]),
  quality: z.object({
    pests: z.boolean().optional(),
    disease: z.boolean().optional(),
    stars: z.number().int().min(1).max(6).optional(),
    notes: z.string().optional(),
  }).optional(),
  passportOverrides: z.object({
    family: z.string().optional(),
    producer_code: z.string().optional(),
    country_code: z.string().optional(),
  }).optional(),
});

type CheckinFormInput = z.infer<typeof CheckinFormSchema>;

type CheckinFormProps = {
  onSubmitSuccess?: (batch: { batchId: string; batchNumber: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
};

export function CheckinForm({
  onSubmitSuccess,
  onCancel,
  isLoading: formIsLoadingProp,
  error: formErrorProp,
}: CheckinFormProps) {
  const { toast } = useToast();
  const activeOrgId = useActiveOrg();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);

  const form = useForm<CheckinFormInput>({
    resolver: zodResolver(CheckinFormSchema),
    defaultValues: {
      phase: "potted", // Default to potted based on common flow
      containers: 1,
      incomingDate: new Date(),
      supplierBatchNumber: '',
      photos: [],
      quality: { pests: false, disease: false, stars: 3, notes: '' },
      passportOverrides: {},
    },
    mode: "onChange",
  });

  const selectedPhase = form.watch("phase");
  const selectedSizeId = form.watch("sizeId");
  const containers = form.watch("containers");
  const overrideTotal = form.watch("overrideTotal");

  // --- Dynamic Data Fetching ---
  const [varieties, setVarieties] = useState<VarietyOption[]>([]);
  const [sizes, setSizes] = useState<PlantSize[]>([]);
  const [locations, setLocations] = useState<NurseryLocation[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [varietySearchQuery, setVarietySearchQuery] = useState('');
  const [sizeSearchQuery, setSizeSearchQuery] = useState('');
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');

  const deferredVarietyQuery = React.useDeferredValue(varietySearchQuery);
  const deferredSizeQuery = React.useDeferredValue(sizeSearchQuery);
  const deferredLocationQuery = React.useDeferredValue(locationSearchQuery);
  const deferredSupplierQuery = React.useDeferredValue(supplierSearchQuery);

  useEffect(() => { // Fetch Varieties
    let active = true;
    searchVarieties(deferredVarietyQuery).then(data => {
      if (active) setVarieties(data as VarietyOption[]);
    }).catch(e => console.error("Failed to fetch varieties:", e));
    return () => { active = false; };
  }, [deferredVarietyQuery]);

  useEffect(() => { // Fetch Sizes
    let active = true;
    searchSizes(deferredSizeQuery).then(data => {
      if (active) setSizes(data as PlantSize[]);
    }).catch(e => console.error("Failed to fetch sizes:", e));
    return () => { active = false; };
  }, [deferredSizeQuery]);

  useEffect(() => { // Fetch Locations
    let active = true;
    searchLocations(deferredLocationQuery).then(data => {
      if (active) setLocations(data as NurseryLocation[]);
    }).catch(e => console.error("Failed to fetch locations:", e));
    return () => { active = false; };
  }, [deferredLocationQuery]);

  useEffect(() => { // Fetch Suppliers
    let active = true;
    searchSuppliers(deferredSupplierQuery).then(data => {
      if (active) setSuppliers(data as Supplier[]);
    }).catch(e => console.error("Failed to fetch suppliers:", e));
    return () => { active = false; };
  }, [deferredSupplierQuery]);

  // --- Calculated Values ---
  const selectedSizeInfo = useMemo(
    () => sizes.find((s) => s.id === selectedSizeId) || null,
    [sizes, selectedSizeId]
  );

  const calculatedTotalUnits = useMemo(() => {
    if (selectedSizeInfo?.multiple) {
      return containers * selectedSizeInfo.multiple;
    }
    return containers; // Default to 1:1 if no multiple or not found
  }, [containers, selectedSizeInfo]);

  useEffect(() => {
    if (!overrideTotal) {
      form.setValue("totalUnits", calculatedTotalUnits, { shouldValidate: true });
    }
  }, [calculatedTotalUnits, overrideTotal, form]);

  // --- Photo Handling ---
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 3 - photoFiles.length) {
      toast({ variant: "destructive", title: "Too many photos", description: "You can upload a maximum of 3 photos." });
      return;
    }
    setPhotoFiles(prev => [...prev, ...files]);
    // In a real app, you'd upload these to Firebase Storage/Supabase Storage here
    // and then get URLs. For this example, we'll simulate it or expect external upload.
    // For now, let's just add a placeholder URL.
    setUploadedPhotoUrls(prev => [...prev, ...files.map(f => `https://placeholder.com/${f.name}`)]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setUploadedPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  // --- Form Submission ---
  const onSubmit = async (values: CheckinFormInput) => {
    if (!activeOrgId) {
      toast({ variant: "destructive", title: "Organization Missing", description: "Please ensure you are associated with an organization." });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        orgId: activeOrgId,
        varietyId: values.varietyId,
        sizeId: values.sizeId,
        locationId: values.locationId,
        phase: values.phase,
        containers: values.containers,
        supplierId: values.supplierId || null,
        supplierBatchNumber: values.supplierBatchNumber,
        incomingDate: format(values.incomingDate, 'yyyy-MM-dd'),
        photos: uploadedPhotoUrls, // Use uploaded URLs
        quality: values.quality,
        passportOverrides: values.passportOverrides,
      };

      const res = await fetch("/api/batches/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to check in batch.");
      }

      const result = await res.json();
      toast({ title: "Check-in Successful", description: `Batch #${result.batch?.batch_number} created.` });
      form.reset();
      setPhotoFiles([]);
      setUploadedPhotoUrls([]);
      onSubmitSuccess?.(result.batch);
    } catch (e: any) {
      console.error("Check-in failed:", e);
      toast({ variant: "destructive", title: "Check-in Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formLoading = formIsLoadingProp || isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Variety */}
          <FormField
            control={form.control}
            name="varietyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Variety</FormLabel>
                <VarietyCombobox
                  value={varieties.find(v => v.id === field.value)?.name || ""}
                  disabled={formLoading}
                  varieties={varieties}
                  onSelect={(v) => {
                    field.onChange(v.id);
                    // You might want to set form values for family/category here if needed elsewhere
                  }}
                  placeholder="Select a variety"
                  emptyMessage="No varieties found."
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Size */}
          <FormField
            control={form.control}
            name="sizeId"
            render={({ field }) => {
              const sizeOptions = useMemo(() => normalizeOptions(sizes.map(s => ({ value: s.id!, label: `${s.name} ${s.containerType ? ` • ${s.containerType}` : ''}` }))), [sizes]);
              return (
                <FormItem>
                  <FormLabel>Size</FormLabel>
                  <SafeSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={sizeOptions}
                    placeholder="Select a size"
                    disabled={formLoading}
                  />
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* Location */}
          <FormField
            control={form.control}
            name="locationId"
            render={({ field }) => {
              const locationOptions = useMemo(() => normalizeOptions(locations.map(l => ({ value: l.id!, label: l.name }))), [locations]);
              return (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <SafeSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={locationOptions}
                    placeholder="Select a location"
                    disabled={formLoading}
                  />
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* Phase */}
          <FormField
            control={form.control}
            name="phase"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phase</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={formLoading}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="propagation">Propagation</SelectItem>
                    <SelectItem value="plug_linear">Plug / Liner</SelectItem>
                    <SelectItem value="potted">Potted</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Containers */}
          <FormField
            control={form.control}
            name="containers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Containers</FormLabel>
                <FormControl>
                  <Input type="number" {...field} disabled={formLoading} />
                </FormControl>
                <FormDescription>Number of trays or pots.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Total Units */}
          <FormField
            control={form.control}
            name="totalUnits"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Units</FormLabel>
                <FormControl>
                  <Input type="number" {...field} disabled={!overrideTotal || formLoading} />
                </FormControl>
                <FormDescription>
                  {overrideTotal
                    ? "Manually override total units."
                    : `Calculated: ${calculatedTotalUnits}`}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Override Total Checkbox */}
          <FormField
            control={form.control}
            name="overrideTotal"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm col-span-full">
                <FormControl>
                  <Input type="checkbox" className="h-4 w-4" checked={field.value} onChange={field.onChange} disabled={formLoading} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Override Calculated Total</FormLabel>
                  <FormDescription>
                    Check this to manually enter the total number of plants instead of calculating from containers and size.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          {/* Incoming Date */}
          <FormField
            control={form.control}
            name="incomingDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Incoming Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn("justify-between", !field.value && "text-muted-foreground")}
                        disabled={formLoading}
                      >
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Supplier */}
          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => {
              const supplierOptions = useMemo(() => normalizeOptions(suppliers.map(s => ({ value: s.id!, label: s.name }))), [suppliers]);
              return (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <SafeSelect
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    options={supplierOptions}
                    placeholder="Select a supplier"
                    disabled={formLoading}
                    hasNone={true}
                  />
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* Supplier Batch Number */}
          <FormField
            control={form.control}
            name="supplierBatchNumber"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Supplier Batch Number</FormLabel>
                <FormControl>
                  <Input {...field} disabled={formLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Photos */}
        <div className="space-y-2 pt-4 border-t">
          <h3 className="font-medium text-lg">Photos ({uploadedPhotoUrls.length}/3)</h3>
          <Input type="file" multiple accept="image/*" onChange={handlePhotoUpload} disabled={uploadedPhotoUrls.length >= 3 || formLoading} />
          <div className="flex flex-wrap gap-2">
            {uploadedPhotoUrls.map((url, index) => (
              <div key={index} className="relative w-24 h-24 rounded-md overflow-hidden group">
                <img src={url} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemovePhoto(index)} disabled={formLoading}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <FormDescription>Upload up to 3 photos for quality control.</FormDescription>
          <FormMessage />
        </div>

        {/* Quality */}        
        <div className="space-y-2 pt-4 border-t">
          <h3 className="font-medium text-lg">Quality Check</h3>
          <FormField
            control={form.control}
            name="quality.stars"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quality Rating</FormLabel>
                <FormControl>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6].map(star => (
                      <Star
                        key={star}
                        className={cn(
                          "h-6 w-6 cursor-pointer",
                          field.value && star <= field.value ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"
                        )}
                        onClick={() => field.onChange(star)}
                      />
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="quality.pests"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                <FormControl>
                  <Input type="checkbox" className="h-4 w-4" checked={field.value} onChange={field.onChange} disabled={formLoading} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Pests Present</FormLabel>
                  <FormDescription>Check if any pests were observed.</FormDescription>
                </div>
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="quality.disease"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                <FormControl>
                  <Input type="checkbox" className="h-4 w-4" checked={field.value} onChange={field.onChange} disabled={formLoading} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Disease Present</FormLabel>
                  <FormDescription>Check if any disease symptoms were observed.</FormDescription>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="quality.notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quality Notes</FormLabel>
                <FormControl>
                  <Input {...field} disabled={formLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Passport Overrides */}
        <div className="space-y-2 pt-4 border-t">
          <h3 className="font-medium text-lg">Passport Overrides (Optional)</h3>
          <p className="text-sm text-muted-foreground">Use these to manually set passport fields if different from defaults.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="passportOverrides.family"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Family Override</FormLabel>
                  <FormControl><Input {...field} disabled={formLoading} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passportOverrides.producer_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Producer Code Override</FormLabel>
                  <FormControl><Input {...field} disabled={formLoading} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passportOverrides.country_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country Code Override</FormLabel>
                  <FormControl><Input {...field} disabled={formLoading} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {formErrorProp && (
          <p className="text-sm font-medium text-destructive">{formErrorProp}</p>
        )}

        <DialogFooter className="sticky bottom-0 z-10 -mx-6 px-6 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t -mb-6 pt-4 pb-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={formLoading}>Cancel</Button>
          <Button type="submit" disabled={formLoading} aria-disabled={formLoading}>Check-in Batch</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
