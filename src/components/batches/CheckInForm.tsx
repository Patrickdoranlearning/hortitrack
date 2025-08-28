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
import { CalendarIcon, Star, Trash2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
import { Checkbox } from "../ui/checkbox";
import { Textarea } from "../ui/textarea";
import { supabaseClient } from "@/lib/supabase/client";

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

// ---------- Helper: upload up to 3 photos, try Firebase first then Supabase Storage
async function uploadPhotos(files: File[]): Promise<string[]> {
    const toUpload = files.slice(0, 3);
    const urls: string[] = [];
  
    if (toUpload.length === 0) return urls;
  
    // Try Firebase Storage (preferred)
    try {
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { app } = await import("@/lib/firebase"); // expected to export initialized Firebase app
      const storage = getStorage(app);
  
      for (const f of toUpload) {
        const path = `batches/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
        const r = ref(storage, path);
        await uploadBytes(r, f, { contentType: f.type });
        const u = await getDownloadURL(r);
        urls.push(u);
      }
      return urls;
    } catch (e) {
      console.warn("Firebase Storage not available, falling back to Supabase Storage.", e);
    }
  
    // Fallback: Supabase Storage (bucket: photos)
    try {
      const supabase = supabaseClient();
      for (const f of toUpload) {
        const path = `batches/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
        const { data, error } = await supabase.storage.from("photos").upload(path, f, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.type,
        });
        if (error) throw error;
        const { data: pub } = supabase.storage.from("photos").getPublicUrl(data.path);
        urls.push(pub.publicUrl);
      }
      return urls;
    } catch (e) {
      console.error("Photo upload failed.", e);
      throw new Error("Photo upload failed. Configure Firebase or Supabase Storage.");
    }
}

// 6-star rating control used by Quality field
function StarRating({
  value = 0,
  onChange,
}: {
  value?: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`Set ${n} stars`}
          className={cn(
            "p-1 rounded-md",
            value >= n ? "opacity-100" : "opacity-40 hover:opacity-70"
          )}
        >
          <Star
            className="h-5 w-5"
            fill={value >= n ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}
  
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

  const form = useForm<CheckinFormInput>({
    resolver: zodResolver(CheckinFormSchema),
    defaultValues: {
      phase: "potted",
      containers: 1,
      overrideTotal: false,
      incomingDate: new Date(),
      supplierBatchNumber: "",
      photos: [],
      quality: { pests: false, disease: false, stars: 3, notes: "" },
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
    if (!activeOrgId) return;
    let active = true;
    searchVarieties(deferredVarietyQuery, activeOrgId).then(data => {
      if (active) setVarieties(data as VarietyOption[]);
    }).catch(e => console.error("Failed to fetch varieties:", e?.message ?? e));
    return () => { active = false; };
  }, [deferredVarietyQuery, activeOrgId]);

  useEffect(() => { // Fetch Sizes
    if (!activeOrgId) return;
    let active = true;
    searchSizes(deferredSizeQuery, activeOrgId).then(data => {
      if (active) setSizes(data as PlantSize[]);
    }).catch(e => console.error("Failed to fetch sizes:", e?.message ?? e));
    return () => { active = false; };
  }, [deferredSizeQuery, activeOrgId]);

  useEffect(() => { // Fetch Locations
    if (!activeOrgId) return;
    let active = true;
    searchLocations(deferredLocationQuery, activeOrgId).then(data => {
      if (active) setLocations(data as NurseryLocation[]);
    }).catch(e => console.error("Failed to fetch locations:", e?.message ?? e));
    return () => { active = false; };
  }, [deferredLocationQuery, activeOrgId]);

  useEffect(() => { // Fetch Suppliers
    if (!activeOrgId) return;
    let active = true;
    searchSuppliers(deferredSupplierQuery, activeOrgId).then(data => {
      if (active) setSuppliers(data as Supplier[]);
    }).catch(e => console.error("Failed to fetch suppliers:", e?.message ?? e));
    return () => { active = false; };
  }, [deferredSupplierQuery, activeOrgId]);

  // --- Calculated Values ---
  const selectedSizeInfo = useMemo(
    () => sizes.find((s) => s.id === selectedSizeId) || null,
    [sizes, selectedSizeId]
  );

  const calculatedTotalUnits = useMemo(() => {
    if (selectedSizeInfo?.multiple) {
      return (Number.isFinite(containers) ? containers : 0) * selectedSizeInfo.multiple;
    }
    return Number.isFinite(containers) ? containers : 0;
  }, [containers, selectedSizeInfo]);

  useEffect(() => {
    if (!overrideTotal) {
      form.setValue("totalUnits", calculatedTotalUnits, { shouldValidate: true });
    }
  }, [calculatedTotalUnits, overrideTotal, form]);

  // --- Photo Handling ---
  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 3) {
      toast({ variant: "destructive", title: "Too many photos", description: "You can upload a maximum of 3 photos." });
      setPhotoFiles([]);
      return;
    }
    setPhotoFiles(files);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- Form Submission ---
  const onSubmit = async (values: CheckinFormInput) => {
    if (!activeOrgId) {
      toast({ variant: "destructive", title: "Organization Missing", description: "Please ensure you are associated with an organization." });
      return;
    }
    setIsSubmitting(true);
    try {
      const uploadedUrls = await uploadPhotos(photoFiles);

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
        photos: uploadedUrls,
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
        {formErrorProp && (
          <p className="text-sm font-medium text-destructive">{formErrorProp}</p>
        )}
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  }}
                  placeholder="Select a variety"
                  emptyMessage="No varieties found."
                />
                <FormMessage />
              </FormItem>
            )}
          />

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

          <FormField
            control={form.control}
            name="containers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Containers</FormLabel>
                <FormControl>
                  <Input type="number" min={1} {...field} disabled={formLoading} onChange={(e) => {
                    const n = e.target.value === "" ? 0 : Number(e.target.value);
                    field.onChange(Number.isFinite(n) ? n : 0);
                  }} value={Number.isFinite(field.value) ? field.value : 0} />
                </FormControl>
                <FormDescription>Number of trays or pots.</FormDescription>
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
                  <Input type="number" {...field} disabled={!overrideTotal || formLoading} onChange={(e) => {
                    const n = e.target.value === "" ? 0 : Number(e.target.value);
                    field.onChange(Number.isFinite(n) ? n : 0);
                  }} value={Number.isFinite(field.value) ? field.value : 0} />
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

          <FormField
            control={form.control}
            name="overrideTotal"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm md:col-span-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={formLoading} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Override Calculated Total</FormLabel>
                  <FormDescription>
                    Check this to manually enter the total number of plants.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

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
                      onSelect={(d) => field.onChange(d!)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

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

          <FormField
            control={form.control}
            name="supplierBatchNumber"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Supplier Batch Number</FormLabel>
                <FormControl>
                  <Input {...field} disabled={formLoading} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ?? "")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2 pt-4 border-t">
          <h3 className="font-medium text-lg">Photos ({photoFiles.length}/3)</h3>
          <Input type="file" multiple accept="image/*" onChange={handlePhotoChange} disabled={photoFiles.length >= 3 || formLoading} />
          <div className="flex flex-wrap gap-2">
            {photoFiles.map((file, index) => (
              <div key={index} className="relative w-24 h-24 rounded-md overflow-hidden group">
                <img src={URL.createObjectURL(file)} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemovePhoto(index)} disabled={formLoading}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <FormDescription>Upload up to 3 photos for quality control.</FormDescription>
        </div>

        <div className="space-y-2 pt-4 border-t">
          <h3 className="font-medium text-lg">Quality Check</h3>
           <FormField
            control={form.control}
            name="quality.stars"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quality Rating</FormLabel>
                <FormControl>
                    <StarRating value={field.value ?? 0} onChange={field.onChange} />
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
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={formLoading} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Pests Present</FormLabel>
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
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={formLoading} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Disease Present</FormLabel>
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
                  <Textarea {...field} disabled={formLoading} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ?? "")}/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2 pt-4 border-t">
          <h3 className="font-medium text-lg">Passport Overrides (Optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="passportOverrides.family"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Family Override</FormLabel>
                  <FormControl><Input {...field} disabled={formLoading} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ?? "")} /></FormControl>
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
                  <FormControl><Input {...field} disabled={formLoading} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ?? "")} /></FormControl>
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
                  <FormControl><Input {...field} disabled={formLoading} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ?? "")}/></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 z-10 -mx-6 px-6 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t -mb-6 pt-4 pb-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={formLoading}>Cancel</Button>
          <Button type="submit" disabled={formLoading} aria-disabled={formLoading}>
            {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Check-in Batch
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}