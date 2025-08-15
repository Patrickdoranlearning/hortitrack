
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { CameraOff } from 'lucide-react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

interface ScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (data: string) => void;
}

export function ScannerDialog({ open, onOpenChange, onScanSuccess }: ScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const { toast } = useToast();

  const stopScanner = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.reset();
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      stopScanner();
    }
    onOpenChange(isOpen);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints, 500);
    readerRef.current = reader;

    const startScanner = async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length === 0) {
          throw new Error('No video input devices found');
        }
        
        const backCamera = devices.find(d => /back|rear|environment/i.test(d.label));
        const deviceId = backCamera?.deviceId || devices[0]?.deviceId;

        if (videoRef.current) {
            setHasPermission(true);
            await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err, controls) => {
                if (result) {
                    onScanSuccess(result.getText());
                    handleOpenChange(false);
                }
                // We don't need to log errors here as they are frequent during scanning
            });
        }
      } catch (err: any) {
        console.error('Camera/Scanner error:', err);
        setHasPermission(false);
        toast({
          variant: 'destructive',
          title: 'Scanner Error',
          description: err.message || 'Could not initialize camera.',
        });
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [open, onScanSuccess, stopScanner, toast, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Batch Data Matrix</DialogTitle>
          <DialogDescription>Point your camera at the Data Matrix code.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square w-full rounded-md overflow-hidden bg-muted">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            autoPlay
            muted
          />
           <div className="pointer-events-none absolute inset-0 grid place-items-center">
             <div className="w-48 h-48 max-w-[65%] max-h-[65%] border-2 border-white/70 rounded" />
           </div>
          {hasPermission === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-md bg-background/80">
                <Alert variant="destructive" className="w-auto">
                    <CameraOff className="h-4 w-4" />
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>
                        Please allow camera access to use this feature.
                    </AlertDescription>
                </Alert>
            </div>
          )}
        </div>
        <p className="mt-2 text-sm text-center text-muted-foreground">
            Tip: Fill the square, keep steady, and use good lighting.
        </p>
      </DialogContent>
    </Dialog>
  );
}
