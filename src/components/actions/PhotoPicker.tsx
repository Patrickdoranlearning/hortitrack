
"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  onChange: (files: File[]) => void;
  max?: number; // default 10
  className?: string;
};

export default function PhotoPicker({ onChange, max = 10, className }: Props) {
  const [files, setFiles] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);

  const apply = (incoming: FileList | null) => {
    if (!incoming) return;
    const current = [...files];
    const pool = Array.from(incoming);
    for (const f of pool) {
      if (current.length >= max) break;
      // de-dupe by name+size
      if (!current.some(x => x.name === f.name && x.size === f.size)) {
        current.push(f);
      }
    }
    setFiles(current);
    onChange(current);
  };

  const removeAt = (i: number) => {
    const next = files.slice();
    next.splice(i, 1);
    setFiles(next);
    onChange(next);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => apply(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => apply(e.target.files)}
      />

      {/* Visible controls */}
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          className="border rounded-md px-3 py-2 text-sm"
          onClick={() => fileInputRef.current?.click()}
        >
          Choose files
        </button>
        <button
          type="button"
          className="border rounded-md px-3 py-2 text-sm"
          onClick={() => cameraInputRef.current?.click()}
        >
          Use camera
        </button>
      </div>

      {/* Preview grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {files.map((f, i) => {
            const url = URL.createObjectURL(f);
            return (
              <div key={`${f.name}-${i}`} className="relative">
                <img src={url} alt={f.name} className="h-20 w-20 object-cover rounded" />
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
