// src/components/photos/PhotoUploader.tsx
"use client";
import React, { useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { uploadActionPhotos } from "@/lib/firebase";

export type PhotoFile = { url: string; path: string; mime: string; size: number };
type Props = {
  value?: PhotoFile[];
  onChange: (files: PhotoFile[]) => void;
  accept?: string;
  max?: number; // default 10
};

export default function PhotoPicker({ value = [], onChange, accept = "image/*", max = 10 }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    
    // In a real app, you would likely want to show a loading state here.
    toast({ title: 'Uploading photos...' });
    
    try {
        // Here we assume the first batchId is the scope for all photos in this action.
        // A more complex app might need to handle this differently.
        const uploadedFiles = await uploadActionPhotos("action-photos", files);
        onChange([...(value ?? []), ...uploadedFiles].slice(0, max));
        toast({ title: 'Upload complete!' });
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Upload failed', description: e.message || 'Could not upload photos.' });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded-xl border shadow-sm text-sm"
          onClick={() => fileRef.current?.click()}
        >
          Choose file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          className="px-3 py-2 rounded-xl border shadow-sm text-sm"
          onClick={() => cameraRef.current?.click()}
        >
          Use camera
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept={accept}
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {value?.length ? (
        <div className="grid grid-cols-4 gap-2 pt-2">
          {value.map((p, i) => (
            <img key={p.path ?? p.url ?? i} src={p.url} alt="" className="h-20 w-full object-cover rounded-md" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
