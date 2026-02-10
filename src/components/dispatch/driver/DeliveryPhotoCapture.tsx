'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Camera, X, Check, RotateCcw, Loader2, Upload } from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface DeliveryPhotoCaptureProps {
  deliveryItemId: string;
  customerName: string;
  orderNumber: string;
  onPhotoCaptured?: (photoUrl: string) => void;
  trigger?: React.ReactNode;
}

export function DeliveryPhotoCapture({
  deliveryItemId,
  customerName,
  orderNumber,
  onPhotoCaptured,
  trigger,
}: DeliveryPhotoCaptureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'camera' | 'preview'>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize camera when dialog opens
  const initCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      const message = err.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera permissions.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : 'Failed to access camera.';
      setCameraError(message);
    }
  }, []);

  // Clean up camera when dialog closes
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Handle dialog open/close
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setMode('camera');
      setCapturedImage(null);
      setCameraError(null);
      // Delay camera init to let dialog render
      setTimeout(initCamera, 100);
    } else {
      stopCamera();
    }
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current frame
    ctx.drawImage(video, 0, 0);

    // Get image data as base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);
    setMode('preview');

    // Stop camera to save resources
    stopCamera();
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
    setMode('camera');
    initCamera();
  };

  // Upload photo and confirm delivery
  const confirmDelivery = async () => {
    if (!capturedImage) return;

    setIsUploading(true);
    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();

      // Create form data
      const formData = new FormData();
      formData.append('photo', blob, `delivery-${deliveryItemId}.jpg`);
      formData.append('deliveryItemId', deliveryItemId);

      // Upload photo
      const uploadRes = await fetch('/api/dispatch/delivery-photo', {
        method: 'POST',
        body: formData,
      });

      const data = await uploadRes.json();
      if (!uploadRes.ok || !data.ok) {
        throw new Error(data.error || 'Failed to upload photo');
      }

      toast.success('Delivery confirmed with photo');
      onPhotoCaptured?.(data.photoUrl);
      setIsOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setIsOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setIsOpen(true)}
        >
          <Camera className="h-4 w-4" />
          Photo Proof
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Delivery Photo
            </DialogTitle>
            <DialogDescription>
              {customerName} - Order #{orderNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {mode === 'camera' ? (
              cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
                  <Camera className="h-12 w-12 mb-4 opacity-50" />
                  <p>{cameraError}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={initCamera}
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
              )
            ) : (
              capturedImage && (
                <img
                  src={capturedImage}
                  alt="Captured delivery"
                  className="w-full h-full object-cover"
                />
              )
            )}

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <DialogFooter className="flex-row gap-2">
            {mode === 'camera' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={capturePhoto}
                  disabled={!!cameraError}
                  className="flex-1 gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Capture
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={retakePhoto}
                  className="flex-1 gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake
                </Button>
                <Button
                  onClick={confirmDelivery}
                  disabled={isUploading}
                  className="flex-1 gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirm
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
