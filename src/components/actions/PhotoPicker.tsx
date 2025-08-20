
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
        <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
        >
            Add Photo
        </button>
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
