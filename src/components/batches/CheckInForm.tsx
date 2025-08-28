
"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Star, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useActiveOrg } from "@/lib/org/context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Checkbox } from "../ui/checkbox";
import { Textarea } from "../ui/textarea";
import { supabaseClient } from "@/lib/supabase/client";
import { ComboBoxEntity } from "../horti/ComboBoxEntity";
import { DialogFooter } from "@/components/ui/dialog";

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

      const payload = {
        orgId: orgId,
        varietyId: values.varietyId,
        sizeId: values.sizeId,
        locationId: values.locationId,
        phase: values.phase,
        containers: values.containers,
        totalUnits: values.totalQuantity,
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

  const formLoading = isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComboBoxEntity
                table="plant_varieties"
                select={VARIETY_SELECT}
                label="Variety"
                orgScoped={false}
                placeholder="Select variety"
                value={form.watch("varietyId")}
                onChange={(item) => form.setValue("varietyId", item?.id ?? "")}
            />
            <ComboBoxEntity
                table="plant_sizes"
                select={SIZE_SELECT}
                label="Size"
                orgScoped={false}
                placeholder="Select size"
                value={form.watch("sizeId")}
                onChange={(item) => {
                    form.setValue("sizeId", item?.id ?? "");
                    setSelectedSize(item);
                }}
            />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComboBoxEntity
                table="nursery_locations"
                select={LOCATION_SELECT}
                label="Location"
                orgScoped={true}
                placeholder="Select location"
                value={form.watch("locationId")}
                onChange={(item) => form.setValue("locationId", item?.id ?? "")}
            />
            <ComboBoxEntity
                table="suppliers"
                select={SUPPLIER_SELECT}
                label="Supplier"
                orgScoped={true}
                placeholder="Select supplier"
                value={form.watch("supplierId")}
                onChange={(item) => form.setValue("supplierId", item?.id ?? "")}
            />
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

