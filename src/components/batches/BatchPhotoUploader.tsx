
"use client";
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Camera, Images, Plus } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Props = {
  batchId: string;
  type: "GROWER" | "SALES";
  role?: "ADMIN" | "GROWER" | "SALES" | "VIEWER";
  onUploaded?: (p: { id: string; url: string; type: string }) => void;
  className?: string;
};

export default function BatchPhotoUploader({ batchId, type, role, onUploaded, className }: Props) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", files[0]);
      fd.append("type", type);
      const res = await fetch(`/api/batches/${batchId}/photos`, {
        method: "POST",
        headers: { "x-role": role ?? "VIEWER" },
        body: fd,
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error?.message || "Upload failed");
      onUploaded?.(j.data);
      toast.success(`${type} photo added`);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (camRef.current) camRef.current.value = "";
      if (galRef.current) galRef.current.value = "";
    }
  }

  return (
    <div className={cn(className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="w-full rounded-2xl" disabled={busy}>
            <Plus className="mr-2 h-4 w-4" /> Add {type === "GROWER" ? "Grower" : "Sales"} Photo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => camRef.current?.click()}><Camera className="mr-2 h-4 w-4" /> Camera</DropdownMenuItem>
          <DropdownMenuItem onClick={() => galRef.current?.click()}><Images className="mr-2 h-4 w-4" /> Gallery</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files)} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
    </div>
  );
}
