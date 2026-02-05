'use client';

import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Camera, X, Image as ImageIcon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Batch } from './ScoutWizard';

export type QualityPhoto = {
  id: string;
  file: File;
  preview: string;
  batchId: string;
  badgeType: 'sales' | 'growing';
};

type QualityPhotoSectionProps = {
  batches: Batch[];
  photos: QualityPhoto[];
  onPhotosChange: (photos: QualityPhoto[]) => void;
  maxPhotos?: number;
};

const BADGE_OPTIONS = [
  { value: 'sales', label: 'Sales Photo', color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'growing', label: 'Grower Photo', color: 'bg-blue-100 text-blue-800 border-blue-300' },
] as const;

export function QualityPhotoSection({
  batches,
  photos,
  onPhotosChange,
  maxPhotos = 5,
}: QualityPhotoSectionProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Default badge type for new photos
  const defaultBadgeType: 'sales' | 'growing' = 'sales';
  // Default batch ID (first batch if available)
  const defaultBatchId = batches[0]?.id || '';

  const handlePhotoSelect = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      if (photos.length >= maxPhotos) return;

      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const newPhoto: QualityPhoto = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview: e.target?.result as string,
          batchId: defaultBatchId,
          badgeType: defaultBadgeType,
        };
        onPhotosChange([...photos, newPhoto]);
      };
      reader.readAsDataURL(file);

      // Reset file inputs
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    },
    [photos, maxPhotos, defaultBatchId, onPhotosChange]
  );

  const removePhoto = useCallback(
    (photoId: string) => {
      onPhotosChange(photos.filter((p) => p.id !== photoId));
    },
    [photos, onPhotosChange]
  );

  const updatePhotoBadge = useCallback(
    (photoId: string, badgeType: 'sales' | 'growing') => {
      onPhotosChange(
        photos.map((p) => (p.id === photoId ? { ...p, badgeType } : p))
      );
    },
    [photos, onPhotosChange]
  );

  const updatePhotoBatch = useCallback(
    (photoId: string, batchId: string) => {
      onPhotosChange(
        photos.map((p) => (p.id === photoId ? { ...p, batchId } : p))
      );
    },
    [photos, onPhotosChange]
  );

  const getBadgeOption = (value: string) =>
    BADGE_OPTIONS.find((opt) => opt.value === value) || BADGE_OPTIONS[0];

  return (
    <div className="space-y-3 pt-4 border-t">
      {/* Section Header */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-amber-500" />
        Quality Photos (Optional)
      </div>
      <p className="text-xs text-muted-foreground">
        Add photos to showcase batch quality for sales or growing records
      </p>

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

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo) => {
            const badgeOpt = getBadgeOption(photo.badgeType);
            return (
              <div
                key={photo.id}
                className={cn(
                  'relative rounded-lg overflow-hidden border-2',
                  photo.badgeType === 'sales' ? 'border-green-300' : 'border-blue-300'
                )}
              >
                {/* Photo Preview */}
                <div className="relative aspect-square">
                  <img
                    src={photo.preview}
                    alt="Quality photo"
                    className="w-full h-full object-cover"
                  />
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {/* Badge indicator */}
                  <Badge
                    variant="outline"
                    className={cn('absolute top-1 left-1 text-[10px] px-1.5 py-0.5', badgeOpt.color)}
                  >
                    {badgeOpt.label}
                  </Badge>
                </div>

                {/* Photo Controls */}
                <div className="p-2 bg-muted/50 space-y-2">
                  {/* Badge Type Toggle */}
                  <div className="flex gap-1">
                    {BADGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updatePhotoBadge(photo.id, opt.value)}
                        className={cn(
                          'flex-1 text-[10px] py-1 px-2 rounded border transition-colors',
                          photo.badgeType === opt.value
                            ? opt.color
                            : 'bg-background border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Batch Selector (only if multiple batches) */}
                  {batches.length > 1 && (
                    <Select
                      value={photo.batchId}
                      onValueChange={(value) => updatePhotoBatch(photo.id, value)}
                    >
                      <SelectTrigger className="h-7 text-[10px]">
                        <SelectValue placeholder="Select batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id} className="text-xs">
                            {batch.batchNumber}
                            {batch.variety && ` - ${batch.variety}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Photo Buttons */}
      {photos.length < maxPhotos && (
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

      {/* Counter */}
      {photos.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {photos.length} / {maxPhotos} photos
        </p>
      )}
    </div>
  );
}
