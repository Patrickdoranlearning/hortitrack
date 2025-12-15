'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Camera,
  X,
  RotateCcw,
  Check,
  Ruler,
  Grid3X3,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface TrialCameraProps {
  groupName: string;
  groupColor: string;
  onCapture: (imageDataUrl: string) => void;
  onClose: () => void;
}

export function TrialCamera({ groupName, groupColor, onCapture, onClose }: TrialCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      // Stop existing stream if any
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Unable to access camera. Please grant camera permissions.');
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame
    ctx.drawImage(video, 0, 0);

    // Add timestamp and group info overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

    ctx.fillStyle = groupColor;
    ctx.fillRect(0, canvas.height - 60, 8, 60);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText(groupName, 20, canvas.height - 32);

    ctx.font = '16px system-ui';
    ctx.fillText(new Date().toLocaleString('en-IE'), 20, canvas.height - 10);

    // Convert to data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(imageDataUrl);
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    setCapturedImage(null);
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4">
        <Card className="p-6 max-w-sm text-center">
          <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={startCamera} className="flex-1">
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {capturedImage ? (
        // Preview captured image
        <div className="relative h-full">
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full h-full object-contain"
          />

          {/* Confirm/Retake buttons */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex gap-3 max-w-md mx-auto">
              <Button
                variant="outline"
                size="lg"
                onClick={handleRetake}
                className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <RotateCcw className="h-5 w-5 mr-2" />
                Retake
              </Button>
              <Button
                size="lg"
                onClick={handleConfirm}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="h-5 w-5 mr-2" />
                Use Photo
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // Live camera view
        <div className="relative h-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Circular pot guide overlay */}
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Concentric circles for pot alignment - scaled to maximize image size */}
              {/* Using vmin units so circles scale with screen, largest pot fills most of view */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                {/* 19cm pot - outermost, fills ~85% of smaller screen dimension */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white/30 rounded-full"
                  style={{ width: '85vmin', height: '85vmin' }}
                />
                {/* 17cm pot */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white/35 rounded-full"
                  style={{ width: '76vmin', height: '76vmin' }}
                />
                {/* 15cm pot */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white/40 rounded-full"
                  style={{ width: '67vmin', height: '67vmin' }}
                />
                {/* 13cm pot */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white/45 rounded-full"
                  style={{ width: '58vmin', height: '58vmin' }}
                />
                {/* 10.5cm pot */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white/50 rounded-full"
                  style={{ width: '47vmin', height: '47vmin' }}
                />
                {/* 9cm pot - innermost */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white/55 rounded-full"
                  style={{ width: '40vmin', height: '40vmin' }}
                />
                {/* Center point */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 border-2 border-white rounded-full bg-white/30" />
                {/* Crosshair through center */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 h-px bg-white/25"
                  style={{ width: '90vmin' }}
                />
                <div
                  className="absolute top-1/2 left-1/2 -translate-y-1/2 w-px bg-white/25"
                  style={{ height: '90vmin' }}
                />
              </div>

              {/* Pot size labels - positioned on the right side of circles */}
              <div className="absolute top-1/2 left-1/2 -translate-y-1/2" style={{ marginLeft: '2vmin' }}>
                <div className="absolute" style={{ top: '-42.5vmin' }}>
                  <span className="text-white/50 text-[10px] font-mono bg-black/60 px-1.5 py-0.5 rounded">19cm</span>
                </div>
                <div className="absolute" style={{ top: '-38vmin' }}>
                  <span className="text-white/55 text-[10px] font-mono bg-black/60 px-1.5 py-0.5 rounded">17cm</span>
                </div>
                <div className="absolute" style={{ top: '-33.5vmin' }}>
                  <span className="text-white/60 text-[10px] font-mono bg-black/60 px-1.5 py-0.5 rounded">15cm</span>
                </div>
                <div className="absolute" style={{ top: '-29vmin' }}>
                  <span className="text-white/65 text-[10px] font-mono bg-black/60 px-1.5 py-0.5 rounded">13cm</span>
                </div>
                <div className="absolute" style={{ top: '-23.5vmin' }}>
                  <span className="text-white/70 text-[10px] font-mono bg-black/60 px-1.5 py-0.5 rounded">10.5</span>
                </div>
                <div className="absolute" style={{ top: '-20vmin' }}>
                  <span className="text-white/75 text-[10px] font-mono bg-black/60 px-1.5 py-0.5 rounded">9cm</span>
                </div>
              </div>

              {/* Alignment tip */}
              <div className="absolute top-16 left-0 right-0 text-center">
                <span className="bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                  Align pot rim with matching circle
                </span>
              </div>
            </div>
          )}

          {/* Top bar with group info */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: groupColor }}
                />
                <span className="text-white font-medium">{groupName}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-between max-w-md mx-auto">
              {/* Toggle grid */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowGrid(!showGrid)}
                className={`text-white hover:bg-white/20 ${showGrid ? 'bg-white/20' : ''}`}
              >
                <Grid3X3 className="h-6 w-6" />
              </Button>

              {/* Capture button */}
              <button
                onClick={handleCapture}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors active:scale-95"
              >
                <div className="w-14 h-14 rounded-full bg-white" />
              </button>

              {/* Switch camera */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCamera}
                className="text-white hover:bg-white/20"
              >
                <RotateCcw className="h-6 w-6" />
              </Button>
            </div>

            {/* Tips */}
            <div className="mt-4 text-center">
              <p className="text-white/70 text-xs">
                Hold phone directly above pot • Align rim with circle guide
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
