// src/components/ui/StarRating.tsx
"use client";
import { Star } from "lucide-react";
import React from "react";

export default function StarRating({ value = 0, onChange }: { value?: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5,6].map(n => (
        <button
          type="button"
          key={n}
          aria-label={`Rate ${n}`}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <Star className={n <= (value ?? 0) ? "fill-current" : ""} />
        </button>
      ))}
    </div>
  );
}