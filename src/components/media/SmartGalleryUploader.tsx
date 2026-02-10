'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  Upload,
  X,
  ImageIcon,
  Loader2,
  Star,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

export type GalleryImage = {
  id: string; // media_library id
  attachmentId?: string; // media_attachments id (optional)
  url: string;
  badge?: string;
  caption?: string;
  isHero: boolean;
  entityType: 'batch' | 'variety' | 'product';
};

type SmartGalleryUploaderProps = {
  entityType: 'batch' | 'variety' | 'product';
  entityId: string;
  images: GalleryImage[];
  onUpload: (file: File) => Promise<void>;
  onDelete?: (imageId: string) => Promise<void>;
  onSetHero?: (imageId: string) => Promise<void>;
  badgeType?: 'live_crop' | 'reference' | 'size_guide' | 'sales' | 'growing';
  maxImages?: number;
  disabled?: boolean;
  className?: string;
};

export function SmartGalleryUploader({
  entityType,
  entityId,
  images,
  onUpload,
  onDelete,
  onSetHero,
  badgeType,
  maxImages = 10,
  disabled = false,
  className,
}: SmartGalleryUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled || uploading) return;

      for (const file of acceptedFiles) {
        if (images.length >= maxImages) break;

        setUploading(true);
        try {
          await onUpload(file);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload failed';
          toast.error(message);
        } finally {
          setUploading(false);
        }
      }
    },
    [disabled, uploading, images.length, maxImages, onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
    },
    maxFiles: maxImages - images.length,
    disabled: disabled || uploading || images.length >= maxImages,
  });

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Get badge label based on entity type
  const getBadgeLabel = () => {
    if (badgeType) {
      switch (badgeType) {
        case 'live_crop':
          return 'Live Crop';
        case 'reference':
          return 'Reference';
        case 'size_guide':
          return 'Size Guide';
        case 'sales':
          return 'Sales Photo';
        case 'growing':
          return 'Grower Photo';
      }
    }
    switch (entityType) {
      case 'batch':
        return 'Live Crop';
      case 'variety':
        return 'Reference';
      case 'product':
        return 'Size Guide';
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
          isDragActive && 'border-primary bg-primary/5',
          disabled && 'opacity-50 cursor-not-allowed',
          !isDragActive && !disabled && 'hover:border-primary/50'
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isDragActive
                ? 'Drop images here...'
                : 'Drag & drop images or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, GIF, WebP • Max 10MB each
            </p>
            {images.length > 0 && (
              <Badge variant="secondary" className="mt-1">
                {images.length} / {maxImages} images
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {images.map((image, index) => (
            <Card
              key={image.id}
              className={cn(
                'relative aspect-square overflow-hidden group cursor-pointer',
                image.isHero && 'ring-2 ring-primary'
              )}
              onClick={() => openLightbox(index)}
            >
              <Image
                src={image.url}
                alt={image.caption || `${entityType} photo ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
              />

              {/* Badge */}
              <Badge
                variant="secondary"
                className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5"
              >
                {image.badge || getBadgeLabel()}
              </Badge>

              {/* Hero star */}
              {image.isHero && (
                <Star className="absolute top-1 right-1 h-4 w-4 fill-yellow-400 text-yellow-400" />
              )}

              {/* Action overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {onSetHero && !image.isHero && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetHero(image.id);
                    }}
                    title="Set as hero image"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(image.id);
                    }}
                    title="Delete image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && !uploading && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
          <p className="text-sm">No images uploaded yet</p>
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>Image gallery</DialogTitle>
          </VisuallyHidden>

          {images.length > 0 && (
            <div className="relative">
              {/* Main image */}
              <div className="relative aspect-[4/3] bg-black">
                <Image
                  src={images[lightboxIndex]?.url || ''}
                  alt={images[lightboxIndex]?.caption || 'Gallery image'}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 80vw"
                />

                {/* Badge */}
                {images[lightboxIndex]?.badge && (
                  <Badge className="absolute top-4 left-4">
                    {images[lightboxIndex].badge}
                  </Badge>
                )}

                {/* Navigation */}
                {images.length > 1 && (
                  <>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
                      onClick={prevImage}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
                      onClick={nextImage}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  </>
                )}

                {/* Close button */}
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full"
                  onClick={() => setLightboxOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Caption and counter */}
              <div className="p-4 bg-background">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {images[lightboxIndex]?.caption || `Image ${lightboxIndex + 1}`}
                  </p>
                  <span className="text-sm text-muted-foreground">
                    {lightboxIndex + 1} / {images.length}
                  </span>
                </div>
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-1 p-2 overflow-x-auto bg-muted/50">
                  {images.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setLightboxIndex(idx)}
                      className={cn(
                        'relative w-16 h-16 shrink-0 rounded overflow-hidden',
                        idx === lightboxIndex && 'ring-2 ring-primary'
                      )}
                    >
                      <Image
                        src={img.url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}



