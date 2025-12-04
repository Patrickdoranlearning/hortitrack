export type ParsedScan
  = { by: "batchNumber"; value: string; raw: string }
  | { by: "id"; value: string; raw: string }
  | { by: "locationId"; value: string; raw: string };

const digitsOnly = (s: string) => s.replace(/\D+/g, '');

export function parseScanCode(input: string): ParsedScan | null {
  if (!input) return null;
  const raw = String(input).trim();

  // Normalize common prefixes
  const lower = raw.toLowerCase();

  // ht:loc:<locationId> - Location codes
  const htLoc = lower.match(/^ht:loc:([a-z0-9-_]+)$/i);
  if (htLoc) {
    return { by: 'locationId', value: htLoc[1], raw };
  }

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

  // UUID-ish id
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    return { by: 'id', value: raw, raw };
  }

  // Plain text fallback: if it contains any digits, try batchNumber
  const plainDigits = digitsOnly(raw);
  if (plainDigits.length >= 3) {
    return { by: 'batchNumber', value: raw, raw };
  }

  return null;
}

/** Helpers to try different normalizations of a batch number. */
export function candidateBatchNumbers(value: string): string[] {
  const v = value.trim();
  const d = digitsOnly(v);
  const uniq = new Set<string>([v, d]);
  return [...uniq].filter(Boolean);
}
