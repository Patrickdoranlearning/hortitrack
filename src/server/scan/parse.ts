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

  // Plain (FNC1) patterns: (^|GS)AI(value..until GS or end)
  const gs = (ai: string, valRe: string) =>
    firstMatch(t, new RegExp(`(?:^|${GS})${ai}(${valRe})`));

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
  console.log("parseScanCode received raw:", JSON.stringify(raw)); // ADDED LOG
  if (!raw) return null;

  // Keep GS, drop other control chars; trim
  let text = raw.replace(/[\u0000-\u001F\u007F]/g, (c) => (c === GS ? GS : "")).trim();
  if (!text) return null;

  // 1) GS1 try
  const ai = parseGS1(text);
  const gs1Batch = ai["10"] || ai["21"] || ai["240"] || ai["91"];
  if (gs1Batch) return { by: "batchNumber", value: gs1Batch.trim() };

  // 2) If any token looks like a 20+ char doc id, use it
  const tokens = text.split(GS).filter(Boolean);
  for (const part of tokens) {
    const p = part.trim();
    if (/^[A-Za-z0-9_-]{20,}$/.test(p)) return { by: "id", value: p };
  }

  // 3) Numeric batch numbers (>=4 digits)
  for (const part of tokens) {
    const p = part.trim();
    if (/^\d{4,}$/.test(p)) return { by: "batchNumber", value: p };
  }

  // 4) Whole string fallback
  if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return { by: "id", value: text };
  if (/^\d{4,}$/.test(text)) return { by: "batchNumber", value: text };

  return null;
}
