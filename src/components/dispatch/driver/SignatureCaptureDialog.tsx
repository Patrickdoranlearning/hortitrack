"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/ui/signature-pad";
import { Camera, Loader2, FileSignature, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SignatureCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerId: string;
  trolleysNotReturned: number;
  shelvesNotReturned?: number;
  haulierId?: string;
  haulierName?: string;
  deliveryRunId?: string;
  onComplete?: (result: {
    signedDocketUrl?: string;
    photoUrl?: string;
    transferRequested?: boolean;
  }) => void;
}

type CaptureMode = "form" | "signature" | "camera" | "preview";

export function SignatureCaptureDialog({
  open,
  onOpenChange,
  customerName,
  customerId,
  trolleysNotReturned,
  shelvesNotReturned = 0,
  haulierId,
  haulierName,
  deliveryRunId,
  onComplete,
}: SignatureCaptureDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<CaptureMode>("form");
  const [signerName, setSignerName] = useState("");
  const [notes, setNotes] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      stopCamera();
      setMode("form");
      setSignerName("");
      setNotes("");
      setSignatureData(null);
      setCapturedPhoto(null);
      setCameraError(null);
    }
    onOpenChange(open);
  };

  // Camera functions
  const initCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
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
      console.error("Camera error:", err);
      const message =
        err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera permissions."
          : err.name === "NotFoundError"
          ? "No camera found on this device."
          : "Failed to access camera.";
      setCameraError(message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const openCamera = () => {
    setMode("camera");
    setTimeout(initCamera, 100);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedPhoto(imageData);
    setMode("preview");
    stopCamera();
  };

  // Submit the signed docket
  const handleSubmit = async () => {
    if (!signatureData) {
      toast({
        variant: "destructive",
        title: "Signature required",
        description: "Please capture the customer's signature.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload signature image
      const formData = new FormData();

      // Convert signature data URL to blob
      const signatureResponse = await fetch(signatureData);
      const signatureBlob = await signatureResponse.blob();
      formData.append("signature", signatureBlob, `signature-${Date.now()}.png`);

      // Add photo if captured
      if (capturedPhoto) {
        const photoResponse = await fetch(capturedPhoto);
        const photoBlob = await photoResponse.blob();
        formData.append("photo", photoBlob, `docket-photo-${Date.now()}.jpg`);
      }

      // Add metadata
      formData.append("customerId", customerId);
      formData.append("signerName", signerName);
      formData.append("trolleys", trolleysNotReturned.toString());
      formData.append("shelves", shelvesNotReturned.toString());
      formData.append("notes", notes);
      if (deliveryRunId) {
        formData.append("deliveryRunId", deliveryRunId);
      }

      // Upload to server
      const uploadRes = await fetch("/api/dispatch/trolleys/signed-docket", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || "Failed to upload signed docket");
      }

      const uploadData = await uploadRes.json();

      // If haulier is involved, request balance transfer
      if (haulierId) {
        const transferRes = await fetch("/api/dispatch/trolleys/transfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromHaulierId: haulierId,
            toCustomerId: customerId,
            trolleys: trolleysNotReturned,
            shelves: shelvesNotReturned,
            deliveryRunId,
            reason: `Customer (${customerName}) did not return trolleys. Signed docket obtained.`,
            driverNotes: notes,
            signedDocketUrl: uploadData.signedDocketUrl,
            photoUrl: uploadData.photoUrl,
          }),
        });

        if (!transferRes.ok) {
          console.error("Failed to request balance transfer");
          // Don't fail the whole operation - the signed docket is still recorded
        }
      }

      toast({
        title: "Signed docket recorded",
        description: haulierId
          ? "Balance transfer request sent for manager approval."
          : "The signed docket has been saved.",
      });

      onComplete?.({
        signedDocketUrl: uploadData.signedDocketUrl,
        photoUrl: uploadData.photoUrl,
        transferRequested: !!haulierId,
      });

      handleOpenChange(false);
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save signed docket",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Capture Signed Docket
          </DialogTitle>
          <DialogDescription>
            Get customer signature to confirm equipment not returned.
          </DialogDescription>
        </DialogHeader>

        {mode === "form" && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-orange-800">Equipment Not Returned</p>
                  <p className="text-orange-700 mt-1">
                    {customerName} owes {trolleysNotReturned} trolley(s)
                    {shelvesNotReturned > 0 && ` and ${shelvesNotReturned} shelf(ves)`}
                  </p>
                  {haulierName && (
                    <p className="text-orange-600 text-xs mt-1">
                      Delivered by: {haulierName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Signer Name */}
            <div className="space-y-2">
              <Label htmlFor="signerName">Customer Representative Name</Label>
              <Input
                id="signerName"
                placeholder="Who is signing?"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
            </div>

            {/* Signature */}
            <div className="space-y-2">
              <Label>Customer Signature *</Label>
              {signatureData ? (
                <div className="relative border rounded-lg p-2 bg-white">
                  <img
                    src={signatureData}
                    alt="Captured signature"
                    className="w-full h-auto"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setSignatureData(null)}
                  >
                    Clear
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-24 gap-2 flex-col"
                  onClick={() => setMode("signature")}
                >
                  <FileSignature className="h-6 w-6" />
                  <span>Tap to capture signature</span>
                </Button>
              )}
            </div>

            {/* Photo (optional) */}
            <div className="space-y-2">
              <Label>Photo of Docket (optional)</Label>
              {capturedPhoto ? (
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <img
                    src={capturedPhoto}
                    alt="Captured docket"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setCapturedPhoto(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-16 gap-2"
                  onClick={openCamera}
                >
                  <Camera className="h-5 w-5" />
                  <span>Take photo of paper docket</span>
                </Button>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about the situation..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !signatureData}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save & Submit
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {mode === "signature" && (
          <SignaturePad
            onCapture={(data) => {
              setSignatureData(data);
              setMode("form");
            }}
            onCancel={() => setMode("form")}
          />
        )}

        {mode === "camera" && (
          <div className="space-y-4">
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  stopCamera();
                  setMode("form");
                }}
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
            </div>
          </div>
        )}

        {mode === "preview" && capturedPhoto && (
          <div className="space-y-4">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <img
                src={capturedPhoto}
                alt="Captured docket"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCapturedPhoto(null);
                  openCamera();
                }}
                className="flex-1"
              >
                Retake
              </Button>
              <Button onClick={() => setMode("form")} className="flex-1 gap-2">
                <Check className="h-4 w-4" />
                Use Photo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
