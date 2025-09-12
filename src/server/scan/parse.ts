// Robust parser for DataMatrix/QR payloads with GS1/AIM.
// Returns { by: "id" | "batchNumber", value } or null.
export type Parsed = { by: "id" | "batchNumber"; value: string };

const GS = String.fromCharCode(29); // FNC1 group separator

function pick<T>(...vals: Array<T | undefined | null>): T | null {
  for (const v of vals) if (v != null && v !== "") return v as T;
  return null;
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  return m ? m[1] : null;
}

// Extract GS1 AI values from plain (FNC1) or parentheses-annotated strings.
function parseGS1(text: string): Record<string, string> {
  const out: Record<string, string> = {};

  // Normalize AIM prefix like "]d2" or "]Q3"
  const t = text.replace(/^\]([A-Za-z][0-9])/, "");

  // Plain (FNC1) patterns: AI(value..until GS or end)
  const gs = (ai: string, valRe: string) =>
    firstMatch(t, new RegExp(`${ai}(${valRe})`));

  // Parentheses patterns: (AI)value(next "(" or end)
  const paren = (ai: string) =>
    firstMatch(t, new RegExp(`\\(${ai}\\)([^()${GS}]+)`));

  // Fixed length
  const ai01 = pick(gs("01", `\\d{14}`), paren("01")); // GTIN-14

  // Variable length until GS / next token
  const varUpToGS = `[^${GS}]+`;
  const ai10 = pick(gs("10", varUpToGS), paren("10")); // Batch/Lot
  const ai21 = pick(gs("21", varUpToGS), paren("21")); // Serial
  const ai240 = pick(gs("240", varUpToGS), paren("240")); // Additional prod id
  // Company internal 91–99 (treat like var length)
  const ai91 = gs("91", varUpToGS) || paren("91") || gs("92", varUpToGS) || paren("92");

  if (ai01) out["01"] = ai01;
  if (ai10) out["10"] = ai10;
  if (ai21) out["21"] = ai21;
  if (ai240) out["240"] = ai240;
  if (ai91) out["91"] = ai91;

  return out;
}

export function parseScanCode(raw: string): Parsed | null {
  if (!raw) return null;
  if (raw.length > 512) return null;

  // Keep GS, drop other control chars; trim
  let text = raw.replace(/[\u0000-\u001F\u007F]/g, (c) => (c === GS ? GS : "")).trim();
  if (!text) return null;

  const lower = text.toLowerCase();

  // Legacy prefixes
  const legacy = lower.replace(new RegExp(GS, 'g'), '').match(/^batch:(\d{3,})$/);
  if (legacy) return { by: 'batchNumber', value: legacy[1] };
  const ht = lower.match(/^ht:batch:([a-z0-9-_]+)$/i);
  if (ht) return { by: 'batchNumber', value: ht[1] };

  // Plain numbers or #numbers
  const hashNum = text.match(/^#?(\d{3,})$/);
  if (hashNum) return { by: 'batchNumber', value: hashNum[1] };

  // URLs
  try {
    const u = new URL(text);
    const pathMatch = u.pathname.match(/\/batches\/([^/]+)/);
    if (pathMatch) {
      const v = pathMatch[1];
      if (/^\d{3,}$/.test(v)) return { by: 'batchNumber', value: v };
      return { by: 'id', value: v };
    }
    const qpBN = u.searchParams.get('batchNumber');
    if (qpBN) return { by: 'batchNumber', value: qpBN };
    const qpId = u.searchParams.get('id');
    if (qpId) return { by: 'id', value: qpId };
  } catch {}

  // JSON
  try {
    const obj = JSON.parse(text);
    if (typeof obj?.batchNumber === 'string') return { by: 'batchNumber', value: obj.batchNumber };
    if (typeof obj?.id === 'string') return { by: 'id', value: obj.id };
  } catch {}

  // GS1 try
  const ai = parseGS1(text);
  const gs1Batch = ai['10'] || ai['21'] || ai['240'] || ai['91'];
  if (gs1Batch) return { by: 'batchNumber', value: gs1Batch.trim() };

  // Token search for id or batch number
  const tokens = text.split(GS).filter(Boolean);
  for (const part of tokens) {
    const p = part.trim();
    if (/^[A-Za-z0-9_-]{20,}$/.test(p)) return { by: 'id', value: p };
  }
  for (const part of tokens) {
    const p = part.trim();
    if (/^\d{4,}$/.test(p)) return { by: 'batchNumber', value: p };
  }

  // Whole string fallback
  if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return { by: 'id', value: text };
  if (/^\d{4,}$/.test(text)) return { by: 'batchNumber', value: text };

  return null;
}
