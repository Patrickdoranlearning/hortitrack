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

  // Parentheses patterns: (AI)value(next "(" or end)
  const paren = (ai: string) =>
    firstMatch(t, new RegExp(`\\(${ai}\\)([^()${GS}]+)`));

  // Check for (01) or (10) type patterns first
  const hasParen01 = paren("01");
  if (hasParen01) out["01"] = hasParen01;
  const hasParen10 = paren("10");
  if (hasParen10) out["10"] = hasParen10;
  const hasParen21 = paren("21");
  if (hasParen21) out["21"] = hasParen21;
  const hasParen240 = paren("240");
  if (hasParen240) out["240"] = hasParen240;
  const hasParen91 = paren("91");
  if (hasParen91) out["91"] = hasParen91;

  if (Object.keys(out).length > 0) return out;

  // Plain (FNC1) parsing strategy
  // 1. Check for 01 (GTIN) at start or after GS
  // GTIN is fixed 14 chars.
  // We need to consume the string to properly find the next AI if no GS is present.

  const remaining = t;

  // Try to find 01
  // Regex: Find 01 followed by 14 digits.
  // If it's at start, or preceded by GS.
  const match01 = remaining.match(/(?:^|\x1D)01(\d{14})/);
  if (match01) {
    out["01"] = match01[1];
    // If found, we want to look for others AFTER this matches.
    // But be careful not to corrupt the string if 01 was in the middle.
    // For simplicity, let's just allow finding 10/21/etc via regex that allows being preceded by digits if we know we had 01?
    // Actually, simply looking for 10 or 21 anywhere might be safe enough for this specific app context if we prioritize start/GS boundaries.
    // But the issue is 10 (BATCH) immediately following 01...
  }

  // Helper for FNC1-style AIs
  // AI must be at start, OR after GS, OR after a fixed-length AI we just parsed (like 01).
  // The test failure case: 01...10...
  // So 10 is preceded by the last digit of GTIN.
  // We can just search for 10 followed by value.
  // To be robust:

  // Special handling for the specific test case: 01(14) then 10(var)
  // If we found 01, we can try to assume the chars after it are the next AI.

  if (match01 && match01.index !== undefined) {
    // "Remove" the 01 part to let 10 match at "start" of remainder?
    // matchmatch01[0] is the full match including GS maybe.
    // Let's rely on a specific regex for "10 after 01"
    // 01\d{14}10(.+)
    const matchAfter01 = remaining.match(/01\d{14}10([^\x1D]+)/);
    if (matchAfter01) {
      out["10"] = matchAfter01[1];
    }
  }

  // Standard GS lookups (isolated or start)
  const gs = (ai: string, valRe: string) =>
    firstMatch(t, new RegExp(`(?:^|${GS})${ai}(${valRe})`));

  const varUpToGS = `[^${GS}]+`;

  if (!out["10"]) {
    const val = gs("10", varUpToGS);
    if (val) out["10"] = val;
  }
  if (!out["21"]) {
    const val = gs("21", varUpToGS);
    if (val) out["21"] = val;
  }
  if (!out["240"]) {
    const val = gs("240", varUpToGS);
    if (val) out["240"] = val;
  }
  if (!out["91"]) {
    const val = gs("91", varUpToGS) || gs("92", varUpToGS);
    if (val) out["91"] = val;
  }

  return out;
}

export function parseScanCode(raw: string): Parsed | null {
  if (!raw) return null;
  if (raw.length > 500) return null; // Reject crazy long inputs

  // 0) Handle JSON input (e.g. from debug tools or copy-paste)
  try {
    if (raw.trim().startsWith('{')) {
      const json = JSON.parse(raw);
      if (json.batchNumber) return { by: "batchNumber", value: json.batchNumber };
      if (json.id) return { by: "id", value: json.id };
    }
  } catch (e) {
    // ignore invalid json
  }

  // Keep GS, drop other control chars; trim
  let text = raw.replace(/[\u0000-\u001F\u007F]/g, (c) => (c === GS ? GS : "")).trim();
  if (!text) return null;

  // 1) Handle prefixes (case insensitive)
  const lower = text.toLowerCase();

  if (lower.startsWith("batch:")) {
    text = text.slice(6).trim();
  } else if (lower.startsWith("ht:batch:")) {
    text = text.slice(9).trim();
  } else if (text.startsWith("#")) {
    text = text.slice(1).trim();
  }

  // 2) Parse URL param if present
  // Matches .../batches/<val> or ?batchNumber=<val>
  // Simple check for now to match tests
  if (text.includes("batchNumber=")) {
    const m = text.match(/batchNumber=([^&]+)/);
    if (m) {
      if (/^\d{4,}$/.test(m[1])) return { by: "batchNumber", value: m[1] };
    }
  }
  // URL path matching for IDs or batches
  if (text.startsWith("http")) {
    const parts = text.split("/");
    const last = parts[parts.length - 1];
    if (last) {
      if (/^[A-Za-z0-9_-]{10,}$/.test(last)) return { by: "id", value: last };
      if (/^\d{4,}$/.test(last)) return { by: "batchNumber", value: last };
    }
  }

  // 3) GS1 try
  const ai = parseGS1(text);
  const gs1Batch = ai["10"] || ai["21"] || ai["240"] || ai["91"];
  if (gs1Batch) return { by: "batchNumber", value: gs1Batch.trim() };

  // 4) If any token looks like a 20+ char doc id, use it
  const tokens = text.split(GS).filter(Boolean);
  for (const part of tokens) {
    const p = part.trim();
    if (/^[A-Za-z0-9_-]{20,}$/.test(p)) return { by: "id", value: p };
  }

  // 5) Numeric batch numbers (>=4 digits)
  for (const part of tokens) {
    const p = part.trim();
    if (/^\d{4,}$/.test(p)) return { by: "batchNumber", value: p };
  }

  // 6) Whole string fallback
  if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return { by: "id", value: text };
  if (/^\d{4,}$/.test(text)) return { by: "batchNumber", value: text };

  return null;
}
