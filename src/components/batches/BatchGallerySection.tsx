'use client';

import * as React from 'react';
import { SmartGalleryUploader } from '@/components/media/SmartGalleryUploader';
import { useSmartGallery } from '@/hooks/useSmartGallery';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Camera, Images, LayoutList, Grid } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GrowthTimelineView } from '@/components/batch/GrowthTimelineView';
import { PhotoComparisonView } from '@/components/batch/PhotoComparisonView';

type GalleryImage = {
  id: string;
  url: string;
  badge?: string;
  caption?: string;
  isHero: boolean;
  entityType: 'batch' | 'variety' | 'product';
  uploadedAt?: string;
};

type BatchGallerySectionProps = {
  batchId: string;
  varietyId?: string | null;
  readOnly?: boolean;
  showTimeline?: boolean;
};

/**
 * Gallery section for batch detail dialogs
 * Allows uploading "Live Crop" photos from camera or gallery
 */
export function BatchGallerySection({
  batchId,
  varietyId,
  readOnly = false,
  showTimeline = true,
}: BatchGallerySectionProps) {
  const [viewMode, setViewMode] = React.useState<'timeline' | 'upload'>('timeline');
  const [compareImages, setCompareImages] = React.useState<[GalleryImage | null, GalleryImage | null]>([null, null]);
  const [showComparison, setShowComparison] = React.useState(false);

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

  const handleCompare = (image1: GalleryImage, image2: GalleryImage) => {
    setCompareImages([image1, image2]);
    setShowComparison(true);
  };

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

  // If we have photos and timeline is enabled, show tabs
  if (showTimeline && images.length > 0) {
    return (
      <div className="space-y-3">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'timeline' | 'upload')}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="timeline" className="flex items-center gap-1">
                <LayoutList className="h-4 w-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-1">
                <Camera className="h-4 w-4" />
                Add Photos
              </TabsTrigger>
            </TabsList>
            <span className="text-sm text-muted-foreground">
              {images.length} photo{images.length !== 1 ? 's' : ''}
            </span>
          </div>

          <TabsContent value="timeline" className="mt-4">
            <GrowthTimelineView
              images={images as GalleryImage[]}
              onCompare={handleCompare}
            />
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
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
          </TabsContent>
        </Tabs>

        {/* Photo Comparison Dialog */}
        <PhotoComparisonView
          open={showComparison}
          onOpenChange={setShowComparison}
          image1={compareImages[0]}
          image2={compareImages[1]}
        />
      </div>
    );
  }

  // No photos or timeline disabled - show upload view
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







