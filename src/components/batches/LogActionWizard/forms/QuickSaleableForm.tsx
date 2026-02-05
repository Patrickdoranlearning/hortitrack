'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Loader2, DollarSign, Package, Camera, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

// ============================================================================
// Schema
// ============================================================================

const STATUS_OPTIONS = [
  { value: 'Ready for Sale', label: 'Ready for Sale', description: 'Available to sell now' },
  { value: 'Looking Good', label: 'Looking Good', description: 'Saleable & premium quality' },
  { value: '', label: 'No Change', description: 'Keep current status' },
] as const;

const QuickSaleableFormSchema = z.object({
  saleableQuantity: z.coerce.number().int().min(0),
  newStatus: z.string().default('Ready for Sale'),
});

type QuickSaleableFormInput = z.infer<typeof QuickSaleableFormSchema>;

// ============================================================================
// Types
// ============================================================================

type QuickSaleableFormProps = {
  batchId: string;
  currentQuantity: number;
  currentSaleableQuantity?: number;
  onComplete: () => void;
  onCancel: () => void;
  setIsSubmitting: (value: boolean) => void;
};

// ============================================================================
// Component
// ============================================================================

export function QuickSaleableForm({
  batchId,
  currentQuantity,
  currentSaleableQuantity = 0,
  onComplete,
  onCancel,
  setIsSubmitting,
}: QuickSaleableFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<QuickSaleableFormInput>({
    resolver: zodResolver(QuickSaleableFormSchema),
    defaultValues: {
      saleableQuantity: currentSaleableQuantity || currentQuantity,
      newStatus: 'Ready for Sale',
    },
  });

  const saleableQuantity = form.watch('saleableQuantity');

  // Handle photo selection
  const handlePhotoSelect = React.useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    setPhotoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const clearPhoto = React.useCallback(() => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  }, []);

  const onSubmit = async (values: QuickSaleableFormInput) => {
    setLoading(true);
    setIsSubmitting(true);

    try {
      // Upload photo if provided (use media system so it appears in Photos tab)
      if (photoFile) {
        setUploadingPhoto(true);
        const fd = new FormData();
        fd.append('file', photoFile);
        fd.append('entityType', 'batch');
        fd.append('entityId', batchId);
        fd.append('badgeType', 'live_crop');

        const photoRes = await fetch('/api/media/upload', {
          method: 'POST',
          body: fd,
        });

        if (!photoRes.ok) {
          const err = await photoRes.json().catch(() => ({}));
          toast.warning('Photo upload failed', {
            description: err.error || 'Could not upload photo',
          });
        }
        setUploadingPhoto(false);
      }

      // Update saleable quantity
      const patchRes = await fetch(`/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleable_quantity: values.saleableQuantity,
        }),
      });

      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update saleable quantity');
      }

      // Update status if selected
      if (values.newStatus) {
        const statusRes = await fetch('/api/batches/bulk-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchIds: [batchId],
            status: values.newStatus,
          }),
        });

        if (!statusRes.ok) {
          // Non-fatal - quantity was updated
          toast.warning('Status update failed, quantity was updated');
        }
      }

      const statusText = values.newStatus ? ` → ${values.newStatus}` : '';
      toast.success('Batch updated', {
        description: `${values.saleableQuantity} saleable${statusText}${photoFile ? ' (with photo)' : ''}`,
      });

      onComplete();
    } catch (error) {
      toast.error('Error updating batch', {
        description: String(error),
      });
    } finally {
      setLoading(false);
      setUploadingPhoto(false);
      setIsSubmitting(false);
    }
  };

  const notSaleable = currentQuantity - saleableQuantity;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Current Stock Summary */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total Stock
            </span>
            <span className="font-semibold">{currentQuantity.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Ready for Sale
            </span>
            <span className="font-semibold text-green-600">{saleableQuantity.toLocaleString()}</span>
          </div>
          {notSaleable > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Not Ready</span>
              <span className="text-muted-foreground">{notSaleable.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Saleable Quantity Slider */}
        <FormField
          name="saleableQuantity"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Saleable Quantity</FormLabel>
              <div className="space-y-4">
                <Slider
                  min={0}
                  max={currentQuantity}
                  step={1}
                  value={[field.value]}
                  onValueChange={([val]) => field.onChange(val)}
                  className="py-4"
                />
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={currentQuantity}
                      {...field}
                      className="w-24"
                    />
                  </FormControl>
                  <span className="text-sm text-muted-foreground">
                    of {currentQuantity.toLocaleString()}
                  </span>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quick Set Buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => form.setValue('saleableQuantity', currentQuantity)}
          >
            All ({currentQuantity})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => form.setValue('saleableQuantity', Math.round(currentQuantity * 0.75))}
          >
            75%
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => form.setValue('saleableQuantity', Math.round(currentQuantity * 0.5))}
          >
            50%
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => form.setValue('saleableQuantity', 0)}
          >
            None
          </Button>
        </div>

        {/* Status Selection */}
        <FormField
          name="newStatus"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Update Status</FormLabel>
              <div className="grid grid-cols-1 gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => field.onChange(option.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      field.value === option.value
                        ? option.value === 'Ready for Sale'
                          ? 'border-green-500 bg-green-50'
                          : option.value === 'Looking Good'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-400 bg-gray-50'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Photo Upload Section */}
        <div className="space-y-2">
          <FormLabel>Sales Photo (optional)</FormLabel>
          <FormDescription className="text-xs">
            Add a photo to showcase the batch quality
          </FormDescription>

          {photoPreview ? (
            <div className="relative rounded-lg overflow-hidden border h-40">
              <Image
                src={photoPreview}
                alt="Preview"
                fill
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={clearPhoto}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-2" />
                Camera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => galleryRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Gallery
              </Button>
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handlePhotoSelect(e.target.files)}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhotoSelect(e.target.files)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploadingPhoto ? 'Uploading photo...' : 'Saving...'}
              </>
            ) : (
              photoFile ? 'Update with Photo' : 'Update Saleable'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default QuickSaleableForm;
