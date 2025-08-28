'use client';
import { useMemo } from 'react';

export default function StarRating({
  value = 0, max = 6, onChange,
}: { value?: number; max?: number; onChange?: (v: number) => void }) {
  const stars = useMemo(() => Array.from({ length: max }, (_, i) => i + 1), [max]);
  return (
    <div role="radiogroup" aria-label="Quality rating" className="flex gap-1">
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange?.(n)}
          className={`size-8 rounded-md border transition ${n <= value ? 'bg-yellow-300' : 'bg-muted'}`}
        >
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}
