'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ImageIcon, X, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { BatchImage } from '@/lib/b2b/types';

interface BatchImageCarouselProps {
  images: BatchImage[];
  className?: string;
  /** Size of the carousel container */
  size?: 'sm' | 'md' | 'lg';
  /** Show navigation arrows */
  showArrows?: boolean;
  /** Show dot indicators */
  showDots?: boolean;
  /** Allow fullscreen on click */
  allowFullscreen?: boolean;
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
};

export function BatchImageCarousel({
  images,
  className,
  size = 'md',
  showArrows = true,
  showDots = true,
  allowFullscreen = true,
}: BatchImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasImages = images.length > 0;
  const hasMultiple = images.length > 1;

  const goToPrevious = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const goToNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  const goToIndex = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    } else if (e.key === 'ArrowRight') {
      setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    } else if (e.key === 'Escape') {
      setIsFullscreen(false);
    }
  }, [images.length]);

  if (!hasImages) {
    return (
      <div className={cn('flex items-center justify-center bg-muted rounded', sizeClasses[size], className)}>
        <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <>
      <div
        className={cn('relative group', sizeClasses[size], className)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label="Image carousel"
      >
        {/* Main image */}
        <div
          className={cn(
            'relative w-full h-full rounded overflow-hidden cursor-pointer bg-muted',
            allowFullscreen && 'hover:opacity-95'
          )}
          onClick={() => allowFullscreen && setIsFullscreen(true)}
        >
          <Image
            src={currentImage.thumbnailUrl || currentImage.imageUrl}
            alt={currentImage.caption || 'Batch image'}
            fill
            className="object-cover"
            sizes={size === 'lg' ? '128px' : size === 'md' ? '96px' : '64px'}
          />

          {/* Zoom icon overlay */}
          {allowFullscreen && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          {/* Hero badge */}
          {currentImage.isHero && (
            <div className="absolute top-1 left-1 px-1 py-0.5 bg-yellow-500/90 text-[10px] font-medium rounded text-white">
              Featured
            </div>
          )}
        </div>

        {/* Navigation arrows */}
        {showArrows && hasMultiple && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-0 top-1/2 -translate-y-1/2 p-0.5 bg-black/50 text-white rounded-r opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-0.5 bg-black/50 text-white rounded-l opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {showDots && hasMultiple && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  goToIndex(index);
                }}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-colors',
                  index === currentIndex
                    ? 'bg-white'
                    : 'bg-white/50 hover:bg-white/75'
                )}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Image counter */}
        {hasMultiple && (
          <div className="absolute top-1 right-1 px-1 py-0.5 bg-black/60 text-[10px] text-white rounded">
            {currentIndex + 1}/{images.length}
          </div>
        )}
      </div>

      {/* Fullscreen dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent
          className="max-w-4xl p-0 bg-black/95 border-none"
          onKeyDown={handleKeyDown}
        >
          <VisuallyHidden>
            <DialogTitle>Batch Image Gallery</DialogTitle>
          </VisuallyHidden>
          <div className="relative w-full aspect-[4/3]">
            <Image
              src={currentImage.imageUrl}
              alt={currentImage.caption || 'Batch image'}
              fill
              className="object-contain"
              sizes="(max-width: 896px) 100vw, 896px"
              priority
            />

            {/* Caption */}
            {currentImage.caption && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white text-sm">{currentImage.caption}</p>
                {currentImage.statusAtCapture && (
                  <p className="text-white/70 text-xs mt-1">
                    Status: {currentImage.statusAtCapture}
                  </p>
                )}
              </div>
            )}

            {/* Fullscreen navigation */}
            {hasMultiple && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrevious}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            {/* Fullscreen close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Fullscreen counter */}
            {hasMultiple && (
              <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-sm text-white rounded">
                {currentIndex + 1} / {images.length}
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {hasMultiple && (
            <div className="flex gap-2 p-4 overflow-x-auto bg-black/80">
              {images.map((img, index) => (
                <button
                  key={img.id}
                  onClick={() => goToIndex(index)}
                  className={cn(
                    'relative w-16 h-16 rounded overflow-hidden flex-shrink-0 border-2 transition-colors',
                    index === currentIndex
                      ? 'border-white'
                      : 'border-transparent hover:border-white/50'
                  )}
                >
                  <Image
                    src={img.thumbnailUrl || img.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
