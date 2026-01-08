'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, XCircle, RefreshCw, Loader2, Flashlight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataMatrixScannerProps {
  onScan: (code: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function DataMatrixScanner({ onScan, onError, className }: DataMatrixScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);

  // Initialize the decoder worker
  const initWorker = useCallback(() => {
    return new Promise<Worker>((resolve, reject) => {
      try {
        const worker = new Worker(
          new URL('@/workers/decoder.worker.ts', import.meta.url),
          { type: 'module' }
        );

        const handleMessage = (e: MessageEvent) => {
          if (e.data?.type === 'READY') {
            worker.removeEventListener('message', handleMessage);
            resolve(worker);
          }
        };

        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', (e) => {
          reject(new Error(`Worker error: ${e.message}`));
        });
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  // Initialize camera
  const initCamera = useCallback(async () => {
    try {
      // Request camera with preferred settings for scanning
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Check for torch support
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      if (capabilities?.torch) {
        setHasTorch(true);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      return true;
    } catch (err: any) {
      console.error('Camera init error:', err);
      const errorMessage = err.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera access to scan labels.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Camera error: ${err.message}`;
      setError(errorMessage);
      onError?.(errorMessage);
      return false;
    }
  }, [onError]);

  // Start scanning loop
  const startScanning = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const worker = workerRef.current;

    if (!video || !canvas || !worker) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    setIsScanning(true);

    const scan = () => {
      if (!video.videoWidth || !video.videoHeight) {
        animationRef.current = requestAnimationFrame(scan);
        return;
      }

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame
      ctx.drawImage(video, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Send to worker for decoding
      worker.postMessage({ type: 'DECODE', imageData });

      // Continue scanning
      animationRef.current = requestAnimationFrame(scan);
    };

    scan();
  }, []);

  // Handle worker messages
  const handleWorkerMessage = useCallback((e: MessageEvent) => {
    const { ok, result, error } = e.data;

    if (ok && result?.text) {
      // Debounce: prevent multiple scans of same code
      const now = Date.now();
      if (now - lastScanTime < 2000) return;
      setLastScanTime(now);

      // Stop scanning and call callback
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      setIsScanning(false);

      console.log('[Scanner] Decoded:', result.text, result.format);
      onScan(result.text);
    }
    // Silently ignore decode failures (normal when no barcode in view)
  }, [lastScanTime, onScan]);

  // Initialize everything
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setIsInitializing(true);
      setError(null);

      try {
        // Initialize worker first
        const worker = await initWorker();
        if (!mounted) {
          worker.terminate();
          return;
        }
        workerRef.current = worker;
        worker.addEventListener('message', handleWorkerMessage);

        // Then initialize camera
        const cameraOk = await initCamera();
        if (!mounted) return;

        if (cameraOk) {
          startScanning();
        }
      } catch (err: any) {
        console.error('Scanner init error:', err);
        setError(err.message || 'Failed to initialize scanner');
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;

      // Clean up animation frame
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      // Clean up camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Clean up worker
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [initWorker, initCamera, startScanning, handleWorkerMessage]);

  // Toggle torch
  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;

    const track = streamRef.current.getVideoTracks()[0];
    const newTorchState = !torchOn;

    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: newTorchState }],
      });
      setTorchOn(newTorchState);
    } catch (err) {
      console.error('Failed to toggle torch:', err);
    }
  };

  // Restart scanner after successful scan
  const restartScanning = () => {
    setLastScanTime(0);
    startScanning();
  };

  // Render error state
  if (error) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardContent className="flex flex-col items-center justify-center p-8 min-h-[300px]">
          <XCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-center text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Render loading state
  if (isInitializing) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardContent className="flex flex-col items-center justify-center p-8 min-h-[300px]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-center text-muted-foreground">
            Initializing camera...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-0 relative">
        {/* Video element (camera feed) */}
        <video
          ref={videoRef}
          className="w-full h-auto"
          playsInline
          muted
          autoPlay
        />

        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Scan frame indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-white rounded-lg shadow-lg opacity-70">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary rounded-br-lg" />
            </div>
          </div>

          {/* Scanning indicator */}
          {isScanning && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Scanning...
            </div>
          )}
        </div>

        {/* Controls overlay */}
        <div className="absolute top-4 right-4 flex gap-2 pointer-events-auto">
          {hasTorch && (
            <Button
              variant={torchOn ? 'default' : 'secondary'}
              size="icon"
              onClick={toggleTorch}
              className="bg-black/40 hover:bg-black/60"
            >
              <Flashlight className={cn('h-4 w-4', torchOn && 'text-yellow-400')} />
            </Button>
          )}
        </div>

        {/* Resume button (shown after scan) */}
        {!isScanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-auto">
            <Button onClick={restartScanning} size="lg">
              <Camera className="h-4 w-4 mr-2" />
              Scan Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
