export type ParsedScan
  = { by: "batchNumber"; value: string; raw: string }
  | { by: "id"; value: string; raw: string }
  | { by: "locationId"; value: string; raw: string }
  | { by: "materialPartNumber"; value: string; raw: string }
  | { by: "materialBarcode"; value: string; raw: string }
  | { by: "lotNumber"; value: string; raw: string }
  | { by: "lotBarcode"; value: string; raw: string }
  | { by: "taskId"; value: string; raw: string };

const digitsOnly = (s: string) => s.replace(/\D+/g, '');

export function parseScanCode(input: string): ParsedScan | null {
  if (!input) return null;
  const raw = String(input).trim();

  // Normalize common prefixes
  const lower = raw.toLowerCase();

  // ht:task:<taskId> - Task codes (UUID format)
  const htTask = lower.match(/^ht:task:([a-f0-9-]{36})$/i);
  if (htTask) {
    return { by: 'taskId', value: htTask[1], raw };
  }

  // ht:loc:<locationId> - Location codes
  const htLoc = lower.match(/^ht:loc:([a-z0-9-_]+)$/i);
  if (htLoc) {
    return { by: 'locationId', value: htLoc[1], raw };
  }

  // ht:mat:<partNumber> - Material short format (e.g., ht:mat:M-POT-001)
  const htMat = lower.match(/^ht:mat:([a-z0-9-_]+)$/i);
  if (htMat) {
    return { by: 'materialPartNumber', value: htMat[1].toUpperCase(), raw };
  }

  // HT:<orgPrefix>:<partNumber> - Full internal material barcode (e.g., HT:abc12345:M-POT-001)
  // This format is used for internal material barcodes
  const htFull = raw.match(/^HT:([a-z0-9]+):(M-[A-Z]{3}-\d+)$/i);
  if (htFull) {
    return { by: 'materialPartNumber', value: htFull[2].toUpperCase(), raw };
  }

  // HT:<orgPrefix>:LOT:<lotNumber> - Material lot barcode (e.g., HT:abc12345:LOT:L-M-POT-001-0042)
  const htLot = raw.match(/^HT:([a-z0-9]+):LOT:(L-M-[A-Z]{3}-\d{3}-\d{4})$/i);
  if (htLot) {
    return { by: 'lotNumber', value: htLot[2].toUpperCase(), raw };
  }

  // L-M-XXX-NNN-NNNN pattern - Direct lot number (e.g., L-M-POT-001-0042)
  const lotNum = raw.match(/^(L-M-[A-Z]{3}-\d{3}-\d{4})$/i);
  if (lotNum) {
    return { by: 'lotNumber', value: lotNum[1].toUpperCase(), raw };
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
  // Also try stripping leading zeros for numeric-only values
  const noLeadingZeros = d.replace(/^0+/, '') || d;
  const uniq = new Set<string>([v, d, noLeadingZeros]);
  return [...uniq].filter(Boolean);
}

/** Strip leading zeros from a string for comparison purposes. */
export function normalizeForComparison(value: string): string {
  const digits = digitsOnly(value);
  return digits.replace(/^0+/, '') || digits;
}

/**
 * Parse a scanned code specifically for material lookup.
 * Returns the search strategy and value to use.
 */
export function parseMaterialScanCode(input: string):
  | { by: "partNumber"; value: string }
  | { by: "barcode"; value: string }
  | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // ht:mat:<partNumber> - Material short format
  const htMat = raw.match(/^ht:mat:([a-z0-9-_]+)$/i);
  if (htMat) {
    return { by: 'partNumber', value: htMat[1].toUpperCase() };
  }

  // HT:<orgPrefix>:<partNumber> - Full internal barcode format
  const htFull = raw.match(/^HT:([a-z0-9]+):(M-[A-Z]{3}-\d+)$/i);
  if (htFull) {
    return { by: 'partNumber', value: htFull[2].toUpperCase() };
  }

  // M-XXX-NNN pattern - Direct part number
  const partNum = raw.match(/^(M-[A-Z]{3}-\d+)$/i);
  if (partNum) {
    return { by: 'partNumber', value: partNum[1].toUpperCase() };
  }

  // Any other non-empty string is treated as an external barcode
  // (EAN, UPC, supplier barcode, etc.)
  if (raw.length >= 3) {
    return { by: 'barcode', value: raw };
  }

  return null;
}

/**
 * Parse a scanned code specifically for material lot lookup.
 * Returns the search strategy and value to use.
 */
export function parseLotScanCode(input: string):
  | { by: "lotNumber"; value: string }
  | { by: "lotBarcode"; value: string }
  | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // HT:<orgPrefix>:LOT:<lotNumber> - Full internal lot barcode format
  const htLot = raw.match(/^HT:([a-z0-9]+):LOT:(L-M-[A-Z]{3}-\d{3}-\d{4})$/i);
  if (htLot) {
    return { by: 'lotNumber', value: htLot[2].toUpperCase() };
  }

  // L-M-XXX-NNN-NNNN pattern - Direct lot number (e.g., L-M-POT-001-0042)
  const lotNum = raw.match(/^(L-M-[A-Z]{3}-\d{3}-\d{4})$/i);
  if (lotNum) {
    return { by: 'lotNumber', value: lotNum[1].toUpperCase() };
  }

  // Any other code starting with L- might be a lot number variant
  const anyLot = raw.match(/^(L-[A-Z0-9-]+)$/i);
  if (anyLot) {
    return { by: 'lotNumber', value: anyLot[1].toUpperCase() };
  }

  // Full barcode format - treat as lot barcode lookup
  if (raw.startsWith('HT:') && raw.includes(':LOT:')) {
    return { by: 'lotBarcode', value: raw };
  }

  return null;
}
