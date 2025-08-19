// src/lib/search.ts
'use client';
import type { Batch } from '@/lib/types';
import { parseScanCode, candidateBatchNumbers } from '@/lib/scan/parse';

export function queryMatchesBatch(query: string, batch: Batch): boolean {
  const q = (query ?? '').trim();
  if (!q) return true;

  const parsed = parseScanCode(q);

  // Strong matches first
  if (parsed?.by === 'id') {
    return String(batch.id ?? '').trim().toLowerCase() === parsed.value.toLowerCase();
  }
  if (parsed?.by === 'batchNumber') {
    const bn = String(batch.batchNumber ?? '').trim().toLowerCase();
    const cands = candidateBatchNumbers(parsed.value).map((s) => s.toLowerCase());
    return cands.some((c) => bn === c);
  }

  // Fallback fuzzy text
  const hay = [
    batch.batchNumber,
    batch.plantFamily,
    batch.plantVariety,
    batch.category,
    batch.supplier ?? '',
    batch.location ?? '',
    batch.id ?? '',
  ]
    .map((s) => String(s ?? '').toLowerCase())
    .join(' ');
  return hay.includes(q.toLowerCase());
}
