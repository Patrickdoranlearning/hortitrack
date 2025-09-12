export type ParsedScan
  = { by: "batchNumber"; value: string; raw: string }
  | { by: "id"; value: string; raw: string };

const digitsOnly = (s: string) => s.replace(/\D+/g, '');

export function parseScanCode(input: string): ParsedScan | null {
  if (!input) return null;
  const raw = String(input).trim();

  // Normalize common prefixes
  const lower = raw.toLowerCase();

  // ht:batch:<code> (allow letters/digits/dashes/underscores)
  const ht = lower.match(/^ht:batch:([a-z0-9-_]+)$/i);
  if (ht) {
    const code = ht[1];
    // Try both dashed and digits-only as potential stored forms
    // Prefer 'batchNumber' match for this form.
    return { by: 'batchNumber', value: code, raw };
  }

  // Leading '#1234567'
  const hash = raw.match(/^#?(\d{3,})$/);
  if (hash) {
    return { by: 'batchNumber', value: hash[1], raw };
  }

  // Allow hashes before ids like '#abc-123'
  const hashId = raw.match(/^#([a-z0-9-_]{3,})$/i);
  if (hashId) {
    return { by: 'id', value: hashId[1], raw };
  }

  // UUID-ish id
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    return { by: 'id', value: raw, raw };
  }

  // Generic id: letters plus at least one digit or separator
  if (/^[a-z0-9-_]+$/i.test(raw) && /[a-z]/i.test(raw) && /[0-9-_]/.test(raw)) {
    return { by: 'id', value: raw, raw };
  }

  // Plain numeric fallback
  const plainDigits = digitsOnly(raw);
  if (plainDigits.length >= 3) {
    return { by: 'batchNumber', value: plainDigits, raw };
  }

  return null;
}

/** Helpers to try different normalizations of a batch number. */
export function candidateBatchNumbers(value: string): string[] {
  const v = value.trim();
  const d = digitsOnly(v);
  const dNoZero = d.replace(/^0+/, '');
  const uniq = new Set<string>([v, d, dNoZero]);
  return [...uniq].filter(Boolean);
}
