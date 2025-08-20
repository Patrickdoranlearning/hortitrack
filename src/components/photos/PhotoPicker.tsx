"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuid } from "uuid";

type Uploaded = { url: string; path: string; width?: number; height?: number };

export function PhotoPicker({
  batchId,
  onUploaded,
  className,
}: {
  batchId: string;
  onUploaded: (files: Uploaded[]) => void;
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function openFile() { fileInputRef.current?.click(); }
  function openCamera() { cameraInputRef.current?.click(); }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const out: Uploaded[] = [];
      for (const f of Array.from(files)) {
        const compressed = await compressImage(f, 1600); // keep it light
        const storage = getStorage();
        const ext = f.name.split(".").pop() || "jpg";
        const path = `actions/${batchId}/${Date.now()}_${uuid()}.${ext}`;
        const r = ref(storage, path);
        const snap = await uploadBytes(r, compressed, { contentType: compressed.type });
        const url = await getDownloadURL(snap.ref);
        out.push({ url, path });
      }
      onUploaded(out);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={openFile} disabled={busy}>
          Choose file
        </Button>
        <Button type="button" variant="secondary" onClick={openCamera} disabled={busy}>
          Use camera
        </Button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

async function compressImage(file: File, maxSize: number): Promise<File> {
  // no-op for non-images
  if (!file.type.startsWith("image/")) return file;

  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.86 });
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}
