"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Camera, Images, Plus } from "lucide-react";

type Props = {
  batchId: string;
  onUploaded?: (p: { id: string; url: string }) => void;
  className?: string;
};

export function BatchPhotoUploader({ batchId, onUploaded, className }: Props) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setHint("Uploading photo…");

    try {
      // Optional client resize (keeps metadata simple). Remove if you want original only.
      const blob = await downscaleIfNeeded(file, 1600, 0.9);
      const form = new FormData();
      form.set("file", blob, file.name);

      const res = await fetch(`/api/batches/${batchId}/photos`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Upload failed");
      }
      setHint("Upload complete.");
      onUploaded?.(json.photo);
    } catch (e: any) {
      console.error(e);
      setHint(e?.message || "Upload failed.");
    } finally {
      setBusy(false);
      // clear file inputs so same file can be reselected
      if (camRef.current) camRef.current.value = "";
      if (galRef.current) galRef.current.value = "";
      setTimeout(() => setHint(null), 2000);
    }
  }

  return (
    <div className={["w-full", className ?? ""].join(" ")}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="w-full rounded-2xl" disabled={busy} data-testid="btn-add-photo">
            <Plus className="mr-2 h-4 w-4" />
            {busy ? "Uploading…" : "Add Photo"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => camRef.current?.click()}>
            <Camera className="mr-2 h-4 w-4" />
            Take Photo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => galRef.current?.click()}>
            <Images className="mr-2 h-4 w-4" />
            Upload from Gallery
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden inputs */}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <input
        ref={galRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />

      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

// downscale images client-side to save bandwidth; preserves EXIF orientation in most modern browsers
async function downscaleIfNeeded(file: File, maxDim: number, quality: number): Promise<Blob> {
  try {
    if (!file.type.startsWith("image/")) return file;
    const imgUrl = URL.createObjectURL(file);
    const img = await loadImage(imgUrl);
    URL.revokeObjectURL(imgUrl);

    const { width, height } = img;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    if (scale >= 1) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b || file), "image/jpeg", quality)
    );
    return blob;
  } catch {
    return file;
  }
}
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}
