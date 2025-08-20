
"use client";

import * as React from "react";

type Photo = File;

type Props = {
  onChange: (files: Photo[]) => void;
  max?: number; // default 10
  className?: string;
  enableDesktopCamera?: boolean; // default false
};

export default function PhotoPicker({ onChange, max = 10, className, enableDesktopCamera = false }: Props) {
  const [files, setFiles] = React.useState<Photo[]>([]);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [showCamera, setShowCamera] = React.useState(false);

  // Basic mobile check: only to decide whether to render capture attr hint
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  function update(list: Photo[]) {
    const trimmed = list.slice(0, max);
    setFiles(trimmed);
    onChange(trimmed);
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    update(picked);
  }

  async function openCamera() {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      setStream(media);
      setShowCamera(true);
      // Attach to <video>
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = media;
      }, 0);
    } catch (e) {
      console.error("getUserMedia failed", e);
      // fallback to file dialog
      inputRef.current?.click();
    }
  }

  function takeSnapshot() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      update([file, ...files]);
      closeCamera();
    }, "image/jpeg", 0.92);
  }

  function closeCamera() {
    setShowCamera(false);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }

  function removeAt(i: number) {
    const next = files.slice();
    next.splice(i, 1);
    update(next);
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          // capture is respected on most mobile browsers; ignored on desktop
          {...(isMobile ? { capture: "environment" as any } : {})}
          multiple
          onChange={onFileInput}
        />
        {enableDesktopCamera && (
          <button
            type="button"
            className="self-start px-3 py-2 rounded-md border text-sm"
            onClick={openCamera}
          >
            Use Camera
          </button>
        )}
      </div>

      {/* Previews */}
      {files.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {files.map((f, i) => {
            const url = URL.createObjectURL(f);
            return (
              <div key={i} className="relative">
                <img src={url} alt={f.name} className="h-24 w-full object-cover rounded-md" />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute top-1 right-1 text-xs bg-white/80 border px-1 rounded"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Minimal camera overlay (desktop optional) */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-3 w-[min(90vw,640px)]">
            <div className="aspect-video bg-black rounded-md overflow-hidden">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="px-3 py-2 rounded-md border" onClick={closeCamera}>Cancel</button>
              <button type="button" className="px-3 py-2 rounded-md border bg-black text-white" onClick={takeSnapshot}>
                Take Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
