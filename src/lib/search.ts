// src/lib/search.ts
'use client';
import type { Batch } from '@/lib/types';
import { parseScanCode, candidateBatchNumbers, normalizeForComparison } from '@/lib/scan/parse';

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

  const qLower = q.toLowerCase();
  const batchId = String(batch.id ?? '').trim().toLowerCase();
  const batchNumber = String(batch.batchNumber ?? '').trim().toLowerCase();

  // First, check for direct ID match (handles non-UUID IDs like 'abc-123')
  // This check runs before parseScanCode to catch IDs that might be misidentified
  if (batchId === qLower || batchId === qLower.replace(/^#/, '')) {
    return true;
  }

  const parsed = parseScanCode(q);

  // Strong matches from scan codes
  if (parsed?.by === 'id') {
    return batchId === parsed.value.toLowerCase();
  }
  if (parsed?.by === 'batchNumber') {
    const bnNormalized = normalizeForComparison(batchNumber);
    const cands = candidateBatchNumbers(parsed.value).map((s) => s.toLowerCase());
    // Match either exact or with leading zeros stripped
    if (cands.some((c) => batchNumber === c || bnNormalized === normalizeForComparison(c))) {
      return true;
    }
    // If batch number match fails, don't return false yet - fall through to fuzzy
  }

  // Fallback fuzzy text
  const hay = [
    batch.batchNumber,
    batch.plantFamily,
    typeof batch.plantVariety === 'string' ? batch.plantVariety : (batch.plantVariety as any)?.name,
    batch.category,
    batch.supplier ?? '',
    typeof batch.location === 'string' 
      ? batch.location 
      : `${(batch.location as any)?.nurserySite ?? ''} ${(batch.location as any)?.name ?? ''}`.trim(),
    batch.status,
    batch.phase,
    typeof batch.size === 'string' 
      ? batch.size 
      : (batch.size as any)?.name,
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
