
"use client";
import React, { useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { uploadActionPhotos } from "@/lib/firebase";

export type PhotoFile = { url: string; path: string; mime: string; size: number };
type Props = {
  onChange: (files: File[]) => void;
  max?: number; // default 10
  className?: string;
};

export default function PhotoPicker({ onChange, max = 10, className }: Props) {
  const [files, setFiles] = React.useState<File[]>([]);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const updatedFiles = [...files, ...Array.from(newFiles)].slice(0, max);
    setFiles(updatedFiles);
    onChange(updatedFiles);
  };
  
  function removeAt(i: number) {
    const next = files.slice();
    next.splice(i, 1);
    setFiles(next);
    onChange(next);
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>Add Photo</Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

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
    </div>
  );
}
