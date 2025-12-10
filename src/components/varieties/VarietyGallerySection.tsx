'use client';

import { SmartGalleryUploader } from '@/components/media/SmartGalleryUploader';
import { useSmartGallery } from '@/hooks/useSmartGallery';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

type VarietyGallerySectionProps = {
  varietyId: string;
  readOnly?: boolean;
};

/**
 * Gallery section for variety edit forms
 * Used to upload reference photos for a plant variety
 */
export function VarietyGallerySection({
  varietyId,
  readOnly = false,
}: VarietyGallerySectionProps) {
  const {
    images,
    loading,
    error,
    uploadImage,
    deleteImage,
    setHeroImage,
  } = useSmartGallery({
    entityType: 'variety',
    entityId: varietyId,
    badgeType: 'reference',
  });

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Reference Photos</Label>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Label>Reference Photos</Label>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        Reference Photos
        {images.length > 0 && (
          <span className="text-muted-foreground font-normal text-xs">
            ({images.length})
          </span>
        )}
      </Label>
      <p className="text-xs text-muted-foreground">
        Upload photos showing the plant at maturity, in bloom, or key identifying features.
      </p>
      <SmartGalleryUploader
        entityType="variety"
        entityId={varietyId}
        images={images}
        onUpload={uploadImage}
        onDelete={readOnly ? undefined : deleteImage}
        onSetHero={readOnly ? undefined : setHeroImage}
        badgeType="reference"
        disabled={readOnly}
        maxImages={5}
      />
    </div>
  );
}

export default VarietyGallerySection;



