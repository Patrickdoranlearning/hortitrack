
"use client";
import React, { useRef } from "react";
import { cn } from "@/lib/utils";

export type PhotoFile = { url: string; path: string; mime: string; size: number };
type Props = {
  onChange: (files: File[]) => void;
  max?: number; // default 10
  className?: string;
};

export default function PhotoPicker({ onChange, max = 10, className }: Props) {
  const [files, setFiles] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    const next = [...files, ...arr].slice(0, max);
    setFiles(next);
    onChange(next);
  };

  function removeAt(i: number) {
    const next = files.slice();
    next.splice(i, 1);
    setFiles(next);
    onChange(next);
  }

  return (
    <div className={className}>
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="border rounded px-3 py-2 text-sm"
          >
            Choose file
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="border rounded px-3 py-2 text-sm"
          >
            Use camera
          </button>
        </div>
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
          multiple={false}
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
