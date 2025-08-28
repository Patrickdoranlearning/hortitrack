
"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActiveOrg } from "@/lib/org/context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarDays, Loader2, Star, Trash2 } from "lucide-react";
import { ComboBoxEntity } from "../horti/ComboBoxEntity";
import { DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

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


// Validation Schema
const CheckinFormSchema = z.object({
  varietyId: z.string().uuid({ message: "Variety is required." }),
  sizeId: z.string().uuid({ message: "Size is required." }),
  locationId: z.string().uuid({ message: "Location is required." }),
  phase: z.enum(["propagation", "plug_linear", "potted"], { required_error: "Phase is required." }),
  containers: z.coerce.number().int().positive({ message: "Number of containers must be positive." }),
  totalQuantity: z.coerce.number().int().positive().optional(),
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
};

// Helper: upload up to 3 photos
async function uploadPhotos(files: File[]): Promise<string[]> {
    const toUpload = files.slice(0, 3);
    const urls: string[] = [];
  
    if (toUpload.length === 0) return urls;
    // For now, we will just return mock URLs, replace with actual upload logic
    for (const f of toUpload) {
        urls.push(`https://picsum.photos/seed/${f.name}/400`);
    }
    return urls;
}

const VARIETY_SELECT = "id,name,family,genus,species";
const SIZE_SELECT = "id,name,container_type,multiple:cell_multiple";
const LOCATION_SELECT = "id,name";
const SUPPLIER_SELECT = "id,name";

export function CheckinForm({
  onSubmitSuccess,
  onCancel,
}: CheckinFormProps) {
  const { toast } = useToast();
  const { orgId } = useActiveOrg();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [selectedSize, setSelectedSize] = useState<{id:string; name:string; meta?:any}|null>(null);

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

  const containers = form.watch("containers");
  const overrideTotal = form.watch("overrideTotal");

  const calculatedTotalUnits = useMemo(() => {
    const multiple = selectedSize?.meta?.multiple ?? 1;
    return (Number.isFinite(containers) ? containers : 0) * multiple;
  }, [containers, selectedSize]);

  useEffect(() => {
    if (!overrideTotal) {
      form.setValue("totalQuantity", calculatedTotalUnits, { shouldValidate: true });
    }
  }, [calculatedTotalUnits, overrideTotal, form]);

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

  const onSubmit = async (values: CheckinFormInput) => {
    if (!orgId) {
      toast({ variant: "destructive", title: "Organization Missing", description: "Please ensure you are associated with an organization." });
      return;
    }
    setIsSubmitting(true);
    try {
      const uploadedUrls = await uploadPhotos(photoFiles);
      const payload = { ...values, photos: uploadedUrls, orgId: orgId };

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
      const newBatch = result.batch?.[0] ?? result.batch;
      toast({ title: "Check-in Successful", description: `Batch #${newBatch.batch_number} created.` });
      form.reset();
      setPhotoFiles([]);
      if (onSubmitSuccess) onSubmitSuccess(newBatch);
    } catch (e: any) {
      console.error("Check-in failed:", e);
      toast({ variant: "destructive", title: "Check-in Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formLoading = isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="varietyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Variety</FormLabel>
                <ComboBoxEntity
                  table="plant_varieties"
                  select={VARIETY_SELECT}
                  orgScoped={false}
                  placeholder="Select variety"
                  value={field.value}
                  onChange={(item) => field.onChange(item?.id)}
                />
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
                <ComboBoxEntity
                  table="plant_sizes"
                  select={SIZE_SELECT}
                  orgScoped={false}
                  placeholder="Select size"
                  value={field.value}
                  onChange={(item) => {
                      field.onChange(item?.id);
                      setSelectedSize(item);
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Location</FormLabel>
                    <ComboBoxEntity
                    table="nursery_locations"
                    select={LOCATION_SELECT}
                    orgScoped={true}
                    placeholder="Select location"
                    value={field.value}
                    onChange={(item) => field.onChange(item?.id)}
                    />
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <ComboBoxEntity
                    table="suppliers"
                    select={SUPPLIER_SELECT}
                    orgScoped={true}
                    placeholder="Select supplier"
                    value={field.value}
                    onChange={(item) => field.onChange(item?.id)}
                    />
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
                control={form.control}
                name="containers"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Containers (pots/trays)</FormLabel>
                        <Input type="number" min={1} {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10))} />
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="totalQuantity"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Total Units</FormLabel>
                        <Input type="number" min={1} {...field} disabled={!form.watch('overrideTotal')} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10))}/>
                        <div className="flex items-center space-x-2 mt-2">
                            <Checkbox id="overrideTotal" checked={form.watch('overrideTotal')} onCheckedChange={c => form.setValue('overrideTotal', !!c)} />
                            <label htmlFor="overrideTotal" className="text-sm">Override</label>
                        </div>
                        <FormMessage />
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
                            <Button type="button" variant="outline" className="justify-start">
                                <CalendarDays className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, 'PP') : 'Select date'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/>
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <FormField
            control={form.control}
            name="supplierBatchNumber"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Supplier Batch Number</FormLabel>
                    <Input {...field} value={field.value ?? ""} placeholder="Supplier's reference number" />
                    <FormMessage />
                </FormItem>
            )}
        />
        
        <div className="space-y-2">
            <Label>Quality Checks</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md border p-4">
                <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="pests" {...form.register('quality.pests')} />
                        <Label htmlFor="pests">Pests Present</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="disease" {...form.register('quality.disease')} />
                        <Label htmlFor="disease">Disease Present</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label>Star Rating:</Label>
                      <StarRating value={form.watch('quality.stars') ?? 0} onChange={n => form.setValue('quality.stars', n)} />
                    </div>
                </div>
                <FormField
                  control={form.control}
                  name="quality.notes"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Quality Notes</FormLabel>
                        <Textarea {...field} value={field.value ?? ""} placeholder="e.g., Some leaf yellowing, but overall healthy." />
                        <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
        </div>

        <div className="space-y-2">
            <Label>Plant Passport Overrides (Optional)</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-md border p-4">
               <FormField
                  control={form.control}
                  name="passportOverrides.family"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Family</FormLabel>
                        <Input {...field} value={field.value ?? ""} placeholder="Auto-filled from variety"/>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="passportOverrides.producer_code"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Producer Code</FormLabel>
                        <Input {...field} value={field.value ?? ""} placeholder="Auto-filled from supplier"/>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="passportOverrides.country_code"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Country Code</FormLabel>
                        <Input {...field} value={field.value ?? ""} placeholder="Auto-filled from supplier"/>
                        <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
        </div>

        <div className="space-y-2">
            <Label>Photos (max 3)</Label>
            <Input id="photos-input" type="file" accept="image/*" multiple onChange={handlePhotoChange} />
            <div className="flex gap-2 flex-wrap">
                {photoFiles.map((file, index) => (
                    <div key={index} className="relative">
                        <img src={URL.createObjectURL(file)} alt="preview" className="h-20 w-20 object-cover rounded-md" />
                        <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-5 w-5" onClick={() => handleRemovePhoto(index)}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
        
        <DialogFooter>
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
