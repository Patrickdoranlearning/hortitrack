'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Upload,
  X,
  Camera,
  ImageIcon,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

type HeroImageUploaderProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Single hero image uploader with file picker and camera support
 * Uploads to /api/media/upload and returns the public URL
 */
export function HeroImageUploader({
  value,
  onChange,
  disabled = false,
  className,
}: HeroImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        // Don't attach to any entity - just upload and get URL

        const response = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Upload failed');
        }

        const data = await response.json();
        onChange(data.filePath);
        toast.success('Image uploaded');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Unable to upload image');
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled || uploading) return;
      if (acceptedFiles.length > 0) {
        await uploadFile(acceptedFiles[0]);
      }
    },
    [disabled, uploading, uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    disabled: disabled || uploading,
  });

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
    // Reset input so same file can be selected again
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Hidden camera input for mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />

      {value ? (
        // Show current image with remove option
        <Card className="relative overflow-hidden">
          <div className="relative aspect-video bg-muted">
            <Image
              src={value}
              alt="Hero image"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          </div>
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="h-8 w-8"
              onClick={handleRemove}
              disabled={disabled || uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </Card>
      ) : (
        // Upload area
        <div className="space-y-2">
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
              isDragActive && 'border-primary bg-primary/5',
              disabled && 'opacity-50 cursor-not-allowed',
              !isDragActive && !disabled && 'hover:border-primary/50'
            )}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive
                    ? 'Drop image here...'
                    : 'Drag & drop or click to browse'}
                </p>
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, GIF, WebP
                </p>
              </div>
            )}
          </div>

          {/* Camera button for mobile */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleCameraCapture}
            disabled={disabled || uploading}
          >
            <Camera className="h-4 w-4 mr-2" />
            Take Photo
          </Button>
        </div>
      )}
    </div>
  );
}

export default HeroImageUploader;
