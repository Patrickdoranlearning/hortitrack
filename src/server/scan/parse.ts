
// src/server/scan/parse.ts
// Robust parser for DataMatrix/QR payloads.
// Returns { by: "id" | "batchNumber", value } or null.
export type Parsed = { by: "id" | "batchNumber"; value: string };

const GS = String.fromCharCode(29); // FNC1 group separator

export function parseScanCode(raw: string): Parsed | null {
  if (!raw || raw.length > 512) return null;

  // 1) Normalize whitespace, strip control chars except GS (we'll handle GS1)
  let text = raw.replace(/[\u0000-\u001E\u007F]/g, (c) => (c === GS ? GS : "")) // keep GS, drop others
                .trim();

  if (!text) return null;

  // 2) Drop AIM Application Identifier prefix like "]d2", "]Q3", case-insensitive
  text = text.replace(/^\]([A-Za-z][0-9])/, "");

  // 3) If GS1-like: split on GS, look for AIs that might contain batch number or our id
  // Common custom payloads often just encode the batchNumber or the doc id plainly.
  const gsParts = text.includes(GS) ? text.split(GS).filter(Boolean) : [text];

  // Heuristic helpers
  const looksLikeDocId = (s: string) => /^[A-Za-z0-9_-]{15,}$/.test(s);
  const looksLikeBatchNumber = (s: string) => /^\d{3,}$/.test(s);

  // 4) Try explicit prefixes first
  const prefixPatterns: [RegExp, "id" | "batchNumber"][] = [
    [/^ht:id:([A-Za-z0-9_-]{15,})$/i, "id"],
    [/^ht:batch:(\d+)$/i, "batchNumber"],
    [/^batch[:\-\s]+(\d+)$/i, "batchNumber"],
    [/^https?:\/\/[^\/]+\/batches\/([A-Za-z0-9_-]{15,})/, "id"],
    [/^https?:\/\/[^\/]+\/batches\/(\d+)/, "batchNumber"],
  ];
  for (const [re, by] of prefixPatterns) {
    const m = re.exec(text);
    if (m?.[1]) return { by, value: m[1] };
  }


  // 5) Try to parse GS1 tokens, looking for lot number (AI 10)
  for (const part of gsParts) {
    const p = part.trim();
    // AI 10 (Lot) is variable length, often ends with FNC1 or end of string
    if (p.startsWith("10")) {
      const lot = p.substring(2);
      if (looksLikeBatchNumber(lot)) return { by: "batchNumber", value: lot };
    }
  }
  
  // 6) Try URL query params
  if (text.includes("?")) {
    try {
        const url = new URL(text);
        const id = url.searchParams.get("id");
        if (id && looksLikeDocId(id)) return { by: "id", value: id };
        const num = url.searchParams.get("batchNumber") || url.searchParams.get("batch");
        if (num && looksLikeBatchNumber(num)) return { by: "batchNumber", value: num };
    } catch {}
  }


  // 7) Try JSON payload
  if (text.startsWith("{") && text.endsWith("}")) {
      try {
          const obj = JSON.parse(text);
          if (obj.id && looksLikeDocId(obj.id)) return { by: "id", value: obj.id };
          if (obj.batchNumber && looksLikeBatchNumber(obj.batchNumber)) return { by: "batchNumber", value: obj.batchNumber };
      } catch {}
  }

  // 8) Final fallback: the whole text if it matches simple patterns
  if (looksLikeDocId(text)) return { by: "id", value: text };
  if (looksLikeBatchNumber(text)) return { by: "batchNumber", value: text };

  return null;
}
