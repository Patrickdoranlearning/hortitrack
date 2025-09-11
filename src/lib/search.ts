// src/lib/search.ts
'use client';
import type { Batch } from '@/lib/types';
import { parseScanCode, candidateBatchNumbers } from '@/lib/scan/parse';

function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length;
  if (m === 0) return n; if (n === 0) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + cost);
    }
  }
  return d[m][n];
}

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
  if (hay.includes(q.toLowerCase())) return true;
  // simple typo tolerance: token-wise Levenshtein <= 1
  const tokens = hay.split(/\s+/).filter(Boolean);
  const tq = q.toLowerCase();
  return tokens.some((t) => levenshtein(t, tq) <= 1);
}
