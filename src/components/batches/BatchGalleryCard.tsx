'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SmartGalleryUploader, GalleryImage } from '@/components/media/SmartGalleryUploader';
import { useSmartGallery } from '@/hooks/useSmartGallery';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type BatchGalleryCardProps = {
  batchId: string;
  varietyId?: string | null;
  productId?: string | null;
  readOnly?: boolean;
};

/**
 * Smart Gallery card for batch detail pages
 * Shows photos from the batch, its variety, and linked products with priority sorting
 */
export function BatchGalleryCard({
  batchId,
  varietyId,
  productId,
  readOnly = false,
}: BatchGalleryCardProps) {
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

  // For read-only view, also fetch variety and product images
  // This would require a modified query - for now, just show batch images

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Photos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Photos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Photos
          {images.length > 0 && (
            <span className="text-muted-foreground font-normal text-sm">
              ({images.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

export default BatchGalleryCard;



