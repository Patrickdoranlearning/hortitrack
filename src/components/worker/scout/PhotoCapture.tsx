"use client";

import { useRef, useState, useCallback } from "react";
import { Camera, Image as ImageIcon, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";

const MAX_PHOTOS = 3;

interface PhotoCaptureProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  disabled?: boolean;
  maxPhotos?: number;
}

export function PhotoCapture({
  photos,
  onPhotosChange,
  disabled = false,
  maxPhotos = MAX_PHOTOS,
}: PhotoCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || disabled) return;
      if (photos.length >= maxPhotos) return;

      setIsProcessing(true);
      vibrateTap();

      try {
        const newPhotos: string[] = [];

        for (let i = 0; i < files.length && photos.length + newPhotos.length < maxPhotos; i++) {
          const file = files[i];
          if (!file.type.startsWith("image/")) continue;

          // Read file as data URL for preview
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          newPhotos.push(dataUrl);
        }

        if (newPhotos.length > 0) {
          vibrateSuccess();
          onPhotosChange([...photos, ...newPhotos]);
        }
      } catch {
        // Photo processing failed silently
      } finally {
        setIsProcessing(false);
        // Clear input values to allow re-selecting same file
        if (cameraRef.current) cameraRef.current.value = "";
        if (galleryRef.current) galleryRef.current.value = "";
      }
    },
    [photos, onPhotosChange, maxPhotos, disabled]
  );

  const removePhoto = (index: number) => {
    vibrateTap();
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  const canAddMore = photos.length < maxPhotos && !disabled;

  return (
    <div className="space-y-3">
      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
        disabled={disabled || isProcessing}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
        disabled={disabled || isProcessing}
      />

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL from camera */}
              <img
                src={photo}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                disabled={disabled}
                className={cn(
                  "absolute top-1 right-1 p-1.5 rounded-full",
                  "bg-black/60 text-white hover:bg-black/80",
                  "active:scale-90 transition-all",
                  "touch-manipulation"
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Add more button in grid if we have space */}
          {canAddMore && photos.length > 0 && (
            <button
              type="button"
              onClick={() => {
                vibrateTap();
                galleryRef.current?.click();
              }}
              disabled={disabled || isProcessing}
              className={cn(
                "aspect-square rounded-lg border-2 border-dashed",
                "flex items-center justify-center",
                "bg-muted/50 hover:bg-muted transition-colors",
                "active:scale-95 touch-manipulation",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Plus className="h-8 w-8 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Capture buttons - show when no photos or can add more */}
      {photos.length === 0 && (
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-20 flex-col gap-2"
            onClick={() => {
              vibrateTap();
              cameraRef.current?.click();
            }}
            disabled={disabled || isProcessing}
          >
            <Camera className="h-6 w-6" />
            <span className="text-sm">Camera</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-20 flex-col gap-2"
            onClick={() => {
              vibrateTap();
              galleryRef.current?.click();
            }}
            disabled={disabled || isProcessing}
          >
            <ImageIcon className="h-6 w-6" />
            <span className="text-sm">Gallery</span>
          </Button>
        </div>
      )}

      {/* Status indicator */}
      <div className="text-center text-sm text-muted-foreground">
        {isProcessing ? (
          "Processing..."
        ) : photos.length > 0 ? (
          `${photos.length}/${maxPhotos} photos`
        ) : (
          "No photos (optional)"
        )}
      </div>
    </div>
  );
}
