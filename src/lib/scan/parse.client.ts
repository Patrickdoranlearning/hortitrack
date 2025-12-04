
// Client-safe parser for DataMatrix/QR payloads with GS1/AIM.
// Mirrors server parse but has no server imports.

export type Parsed = { by: "id" | "batchNumber" | "locationId"; value: string };

const GS = String.fromCharCode(29); // FNC1 group separator

function pick<T>(...vals: Array<T | undefined | null>): T | null {
  for (const v of vals) if (v != null && v !== "") return v as T;
  return null;
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  return m ? m[1] : null;
}

function parseGS1(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Trim AIM prefix like ]d2 or ]Q3
  const t = text.replace(/^\]([A-Za-z][0-9])/, "");

  // Plain FNC1 segments and (AI)parentheses segments
  const gs = (ai: string, valRe: string) =>
    firstMatch(t, new RegExp(`(?:^|${GS})${ai}(${valRe})`));
  const paren = (ai: string) =>
    firstMatch(t, new RegExp(`\\(${ai}\\)([^()${GS}]+)`));

  const ai01 = pick(gs("01", `\\d{14}`), paren("01")); // GTIN
  const varUpToGS = `[^${GS}]+`;
  const ai10 = pick(gs("10", varUpToGS), paren("10")); // Batch/Lot
  const ai21 = pick(gs("21", varUpToGS), paren("21")); // Serial
  const ai240 = pick(gs("240", varUpToGS), paren("240"));
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

  // Keep GS (FNC1), drop other control chars
  let text = raw.replace(/[\u0000-\u001F\u007F]/g, (c) => (c === GS ? GS : "")).trim();
  if (!text) return null;

  // Check for HortiTrack location code format: ht:loc:<id>
  const htLoc = text.toLowerCase().match(/^ht:loc:([a-z0-9-_]+)$/i);
  if (htLoc) return { by: "locationId", value: htLoc[1] };

  // Check for HortiTrack batch code format: ht:batch:<code>
  const htBatch = text.toLowerCase().match(/^ht:batch:([a-z0-9-_]+)$/i);
  if (htBatch) return { by: "batchNumber", value: htBatch[1] };

  // GS1 candidates
  const ai = parseGS1(text);
  const gs1Batch = ai["10"] || ai["21"] || ai["240"] || ai["91"];
  if (gs1Batch) return { by: "batchNumber", value: gs1Batch.trim() };

  // Tokens (split by GS if present)
  const tokens = text.split(GS).filter(Boolean);

  // Doc id heuristic (Firestore doc ids / ULIDs / etc.)
  for (const p of tokens) if (/^[A-Za-z0-9_-]{20,}$/.test(p.trim())) return { by: "id", value: p.trim() };

  // Numeric batch numbers (>=4 digits)
  for (const p of tokens) if (/^\d{4,}$/.test(p.trim())) return { by: "batchNumber", value: p.trim() };

  // Whole-string fallback
  if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return { by: "id", value: text };
  if (/^\d{4,}$/.test(text)) return { by: "batchNumber", value: text };

  return null;
}

// Helper to visualize FNC1 in UI
export function visualize(raw: string): string {
  const GS = String.fromCharCode(29);
  // U+241D is the "SYMBOL FOR GROUP SEPARATOR" ␝
  return raw.replaceAll(GS, "␝");
}
