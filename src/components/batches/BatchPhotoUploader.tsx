
"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Camera, Images, Plus } from "lucide-react";
import { uploadBatchPhoto } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

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
  const normalizedId = String(batchId ?? "").trim();
  const validId = normalizedId.length > 6;
  const { toast } = useToast();


  async function upload(file: File) {
    if (!validId) {
      console.warn("[uploader] missing batchId:", batchId);
      setHint("Save the batch before adding photos.");
      return;
    }

    setBusy(true);
    setHint("Uploading photo…");

    try {
      const url = await uploadBatchPhoto(normalizedId, file);
      
      const newPhoto = { id: `photo_${Date.now()}`, url };

      await fetch(`/api/batches/${encodeURIComponent(normalizedId)}/log`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "Photo", photoUrl: url, note: `Photo added: ${file.name}` }),
      });
      
      toast({ title: "Photo uploaded", description: "The photo has been logged for this batch." });
      onUploaded?.(newPhoto);

    } catch (e: any) {
      console.error(e);
      setHint(e?.message || "Upload failed.");
      toast({ variant: "destructive", title: "Upload Failed", description: e?.message ?? "An error occurred during upload." });
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
          <Button
            className="w-full rounded-2xl"
            disabled={busy || !validId}
            title={!validId ? "Save the batch first" : undefined}
            data-testid="btn-add-photo"
          >
            <Plus className="mr-2 h-4 w-4" />
            {busy ? "Uploading…" : "Add Photo"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            disabled={!validId}
            onClick={() => validId && camRef.current?.click()}
          >
            <Camera className="mr-2 h-4 w-4" />
            Take Photo
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!validId}
            onClick={() => validId && galRef.current?.click()}
          >
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
        onChange={(e) => { if (!validId) return; if (e.target.files?.[0]) upload(e.target.files[0]); }}
      />
      <input
        ref={galRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { if (!validId) return; if (e.target.files?.[0]) upload(e.target.files[0]); }}
      />

      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
      {!validId && <div className="mt-2 text-xs text-amber-600">Save the batch before adding photos.</div>}
    </div>
  );
}
