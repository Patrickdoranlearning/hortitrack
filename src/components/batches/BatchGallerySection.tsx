'use client';

import { SmartGalleryUploader } from '@/components/media/SmartGalleryUploader';
import { useSmartGallery } from '@/hooks/useSmartGallery';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Camera, Images } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type BatchGallerySectionProps = {
  batchId: string;
  varietyId?: string | null;
  readOnly?: boolean;
};

/**
 * Gallery section for batch detail dialogs
 * Allows uploading "Live Crop" photos from camera or gallery
 */
export function BatchGallerySection({
  batchId,
  varietyId,
  readOnly = false,
}: BatchGallerySectionProps) {
  const {
    images,
    loading,
    error,
    uploadImage,
    deleteImage,
    setHeroImage,
  } = useSmartGallery({
    entityType: 'batch',
    entityId: batchId,
    badgeType: 'live_crop',
  });

  if (loading) {
    return (
      <div className="space-y-3">
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
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Camera className="h-4 w-4" />
        <span>Take a photo or upload from your gallery to document this batch</span>
      </div>
      
      <SmartGalleryUploader
        entityType="batch"
        entityId={batchId}
        images={images}
        onUpload={uploadImage}
        onDelete={readOnly ? undefined : deleteImage}
        onSetHero={readOnly ? undefined : setHeroImage}
        badgeType="live_crop"
        disabled={readOnly}
        maxImages={10}
      />

      {images.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Photos help track plant growth and quality over time. They also appear in the B2B catalog!
        </p>
      )}
    </div>
  );
}

export default BatchGallerySection;







