'use client';

import { SmartGalleryUploader } from '@/components/media/SmartGalleryUploader';
import { useSmartGallery } from '@/hooks/useSmartGallery';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

type ProductGallerySectionProps = {
  productId: string;
  readOnly?: boolean;
};

/**
 * Gallery section for product management
 * Used to upload size reference photos for a product
 */
export function ProductGallerySection({
  productId,
  readOnly = false,
}: ProductGallerySectionProps) {
  const {
    images,
    loading,
    error,
    uploadImage,
    deleteImage,
    setHeroImage,
  } = useSmartGallery({
    entityType: 'product',
    entityId: productId,
    badgeType: 'size_guide',
  });

  if (loading) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Size Reference Photos
        </Label>
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
        <Label>Size Reference Photos</Label>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Size Reference Photos
          {images.length > 0 && (
            <span className="text-muted-foreground font-normal text-xs">
              ({images.length})
            </span>
          )}
        </Label>
        <p className="text-sm text-muted-foreground">
          Upload photos showing the pot size, typical plant height, or product packaging.
          These appear in the B2B catalog when no batch-specific photos are available.
        </p>
      </div>
      <SmartGalleryUploader
        entityType="product"
        entityId={productId}
        images={images}
        onUpload={uploadImage}
        onDelete={readOnly ? undefined : deleteImage}
        onSetHero={readOnly ? undefined : setHeroImage}
        badgeType="size_guide"
        disabled={readOnly}
        maxImages={5}
      />
    </div>
  );
}

export default ProductGallerySection;



