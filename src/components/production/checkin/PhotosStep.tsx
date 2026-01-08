'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  Camera,
  Upload,
  X,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type PhotoData = {
  id: string;
  file?: File;
  url?: string;
  preview: string;
  uploading?: boolean;
  uploaded?: boolean;
};

export type PhotosStepData = {
  photos: PhotoData[];
};

type PhotosStepProps = {
  initialData: PhotosStepData | null;
  onComplete: (data: PhotosStepData) => void;
  onBack: () => void;
  isSubmitting?: boolean;
};

export function PhotosStep({
  initialData,
  onComplete,
  onBack,
  isSubmitting,
}: PhotosStepProps) {
  const [photos, setPhotos] = useState<PhotoData[]>(initialData?.photos ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const newPhotos: PhotoData[] = Array.from(files).map((file) => ({
      id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...newPhotos]);
  }, []);

  // Remove photo
  const removePhoto = useCallback((photoId: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === photoId);
      if (photo?.preview && photo.file) {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter((p) => p.id !== photoId);
    });
  }, []);

  const handleSubmit = () => {
    onComplete({ photos });
  };

  return (
    <div className="space-y-6">
      {/* Photo Count Badge */}
      <div className="flex items-center gap-2">
        <Badge variant={photos.length > 0 ? 'default' : 'secondary'}>
          {photos.length} photo{photos.length !== 1 ? 's' : ''}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {photos.length === 0 ? 'No photos added yet' : 'Ready to submit'}
        </span>
      </div>

      {/* Upload Buttons */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => cameraInputRef.current?.click()}
        >
          <CardContent className="pt-6 text-center">
            <Camera className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Take Photo</p>
            <p className="text-sm text-muted-foreground">Use device camera</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="pt-6 text-center">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Upload Photos</p>
            <p className="text-sm text-muted-foreground">Select from device</p>
          </CardContent>
        </Card>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Photo Grid */}
      {photos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Delivery Photos</CardTitle>
            <CardDescription>
              Photos will be attached to all batches in this delivery
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group aspect-square rounded-lg overflow-hidden border bg-muted"
                >
                  <img
                    src={photo.preview}
                    alt="Delivery photo"
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removePhoto(photo.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Status indicator */}
                  {photo.uploading && (
                    <div className="absolute bottom-2 right-2">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </div>
                  )}
                  {photo.uploaded && (
                    <div className="absolute bottom-2 right-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    </div>
                  )}
                </div>
              ))}

              {/* Add more button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <ImageIcon className="h-8 w-8 mb-2" />
                <span className="text-sm">Add more</span>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {photos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No photos added yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Photos are optional but recommended for quality records
            </p>
          </CardContent>
        </Card>
      )}

      {/* Skip notice */}
      <p className="text-sm text-muted-foreground text-center">
        Photos are optional. You can skip this step and complete the check-in.
      </p>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking in...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Complete Check-in
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
