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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Check, RotateCcw, Loader2, Truck, Package } from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryCompletionDialogProps {
  deliveryItemId: string;
  customerName: string;
  orderNumber: string;
  trolleysDelivered: number;
  onCompleted?: (data: { photoUrl?: string; trolleysReturned: number }) => void;
  trigger?: React.ReactNode;
}

export function DeliveryCompletionDialog({
  deliveryItemId,
  customerName,
  orderNumber,
  trolleysDelivered,
  onCompleted,
  trigger,
}: DeliveryCompletionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'form' | 'camera' | 'preview'>('form');
  const [trolleysReturned, setTrolleysReturned] = useState(0);
  const [recipientName, setRecipientName] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const trolleysOutstanding = trolleysDelivered - trolleysReturned;

  // Initialize camera
  const initCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
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
      console.error('Camera error:', err);
      const message = err.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera permissions.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : 'Failed to access camera.';
      setCameraError(message);
    }
  }, []);

  // Clean up camera
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
      setMode('form');
      setTrolleysReturned(0);
      setRecipientName('');
      setCapturedImage(null);
      setCameraError(null);
    } else {
      stopCamera();
    }
  };

  // Open camera mode
  const openCamera = () => {
    setMode('camera');
    setTimeout(initCamera, 100);
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);
    setMode('preview');
    stopCamera();
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
    setMode('camera');
    initCamera();
  };

  // Back to form
  const backToForm = () => {
    stopCamera();
    setMode('form');
  };

  // Submit delivery completion
  const confirmDelivery = async () => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('deliveryItemId', deliveryItemId);
      formData.append('trolleysReturned', trolleysReturned.toString());

      if (recipientName.trim()) {
        formData.append('recipientName', recipientName.trim());
      }

      // Convert captured image to blob if exists
      if (capturedImage) {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        formData.append('photo', blob, `delivery-${deliveryItemId}.jpg`);
      }

      // Call the complete-delivery API
      const res = await fetch('/api/dispatch/complete-delivery', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to complete delivery');
      }

      toast.success('Delivery completed successfully');
      onCompleted?.({ photoUrl: data.photoUrl, trolleysReturned });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Delivery completion error:', error);
      toast.error(error.message || 'Failed to complete delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setIsOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="default"
          size="sm"
          className="gap-2"
          onClick={() => setIsOpen(true)}
        >
          <Check className="h-4 w-4" />
          Complete Delivery
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Complete Delivery
            </DialogTitle>
            <DialogDescription>
              {customerName} - Order #{orderNumber}
            </DialogDescription>
          </DialogHeader>

          {mode === 'form' && (
            <>
              {/* Trolley Information */}
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Trolleys Delivered</span>
                    <span className="font-semibold">{trolleysDelivered}</span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trolleysReturned">Trolleys Returned</Label>
                    <Input
                      id="trolleysReturned"
                      type="number"
                      min={0}
                      max={trolleysDelivered + 10} // Allow some extra for returns from previous deliveries
                      value={trolleysReturned}
                      onChange={(e) => setTrolleysReturned(Math.max(0, parseInt(e.target.value) || 0))}
                      className="text-lg font-semibold"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the number of empty trolleys collected from the customer
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium">Outstanding</span>
                    <span className={`font-bold text-lg ${trolleysOutstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {trolleysOutstanding}
                    </span>
                  </div>
                </div>

                {/* Recipient Name */}
                <div className="space-y-2">
                  <Label htmlFor="recipientName">Recipient Name (optional)</Label>
                  <Input
                    id="recipientName"
                    placeholder="Who received the delivery?"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>

                {/* Photo Section */}
                <div className="space-y-2">
                  <Label>Delivery Photo (optional)</Label>
                  {capturedImage ? (
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                      <img
                        src={capturedImage}
                        alt="Captured delivery"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute bottom-2 right-2 gap-1"
                        onClick={() => {
                          setCapturedImage(null);
                          openCamera();
                        }}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Retake
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-24 gap-2 flex-col"
                      onClick={openCamera}
                    >
                      <Camera className="h-6 w-6" />
                      <span>Tap to capture photo</span>
                    </Button>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-row gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDelivery}
                  disabled={isSubmitting}
                  className="flex-1 gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirm Delivery
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {mode === 'camera' && (
            <>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                {cameraError ? (
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
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <DialogFooter className="flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={backToForm}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={capturePhoto}
                  disabled={!!cameraError}
                  className="flex-1 gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Capture
                </Button>
              </DialogFooter>
            </>
          )}

          {mode === 'preview' && capturedImage && (
            <>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <img
                  src={capturedImage}
                  alt="Captured delivery"
                  className="w-full h-full object-cover"
                />
              </div>

              <DialogFooter className="flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={retakePhoto}
                  className="flex-1 gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake
                </Button>
                <Button
                  onClick={backToForm}
                  className="flex-1 gap-2"
                >
                  <Check className="h-4 w-4" />
                  Use Photo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
