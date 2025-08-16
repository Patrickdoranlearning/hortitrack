// src/server/scan/parse.ts
export type ParsedScan = { by: "id" | "batchNumber"; value: string } | null;

const ID_RE = /^[A-Za-z0-9_-]{15,}$/;

/** Extract AI segments from a GS1-like string. Minimal support for common AIs. */
function parseGs1(rawIn: string): ParsedScan {
  if (!rawIn) return null;

  // Keep original for FNC1-based parsing
  let s = rawIn.trim();

  // AIM Symbology prefix for Data Matrix may appear: "]d2"
  if (s.startsWith("]d2") || s.startsWith("]D2")) s = s.slice(3);

  // Fast-path: FNC1 (GS) present → variable-length AIs end at \x1D
  // AI 10 = batch/lot, variable-length up to 20.
  const m10WithGS = /(?:^|\x1D)10([A-Za-z0-9\-./]{1,20})(?:\x1D|$)/.exec(s);
  if (m10WithGS) {
    const lot = m10WithGS[1];
    if (/^\d+$/.test(lot)) return { by: "batchNumber", value: lot };
  }

  // No GS present (some encoders omit explicit FNC1 between final AI and EoS).
  // Heuristic: find AI "10" and cut at the next known AI start, else EoS.
  const KNOWN_AI = /(01|21|17|11|13|15|30|37|240|241|242|250|251)/g;
  const idx10 = s.indexOf("10");
  if (idx10 >= 0) {
    const rest = s.slice(idx10 + 2);
    let cut = rest.length;
    // find earliest next AI occurrence in the remainder
    let m: RegExpExecArray | null;
    while ((m = KNOWN_AI.exec(rest))) {
      cut = Math.min(cut, m.index);
      break;
    }
    const lot = rest.slice(0, cut);
    const trimmed = lot.replace(/\x1D/g, ""); // just in case
    if (/^\d{3,}$/.test(trimmed)) {
      return { by: "batchNumber", value: trimmed };
    }
  }

  return null;
}

/** Normalize & parse any scan payload into a queryable key. */
export function parseScanCode(raw: string): ParsedScan {
  if (!raw) return null;

  // Preserve a copy with FNC1 for GS1 parsing
  const rawTrim = String(raw).trim();

  // Also build a control-stripped variant for non-GS1 paths
  const stripped = rawTrim.replace(/[\x00-\x1F]/g, ""); // drop control chars incl. \x1D

  // 1) Preferred encodings
  let m = /^ht:batch:(\d+)$/i.exec(stripped);
  if (m) return { by: "batchNumber", value: m[1] };
  m = /^ht:id:([A-Za-z0-9_-]{15,})$/i.exec(stripped);
  if (m) return { by: "id", value: m[1] };

  // 1b) Legacy: BATCH:123, BATCH-123, BATCH 123
  m = /^batch[:\-\s]+(\d+)$/i.exec(stripped);
  if (m) return { by: "batchNumber", value: m[1] };

  // 2) GS1 DataMatrix (use raw with FNC1 first)
  const gs1 = parseGs1(rawTrim) || parseGs1(stripped);
  if (gs1) return gs1;

  // 3) Pure number or #number
  m = /^(?:#)?(\d+)$/.exec(stripped);
  if (m) return { by: "batchNumber", value: m[1] };

  // 4) URLs that embed id or number
  try {
    const u = new URL(stripped);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p.toLowerCase() === "batches");
    if (idx >= 0 && parts[idx + 1]) {
      const val = parts[idx + 1];
      if (/^\d+$/.test(val)) return { by: "batchNumber", value: val };
      if (ID_RE.test(val)) return { by: "id", value: val };
    }
    const qpId = u.searchParams.get("id");
    if (qpId && ID_RE.test(qpId)) return { by: "id", value: qpId };
    const qpNum = u.searchParams.get("batchNumber") || u.searchParams.get("batch");
    if (qpNum && /^\d+$/.test(qpNum)) return { by: "batchNumber", value: qpNum };
  } catch {
    // not a URL
  }

  // 5) JSON {"id":"…"} or {"batchNumber":"123"}
  const looksJson = (stripped.startsWith("{") && stripped.endsWith("}")) || stripped.toUpperCase().startsWith("%7B");
  if (looksJson) {
    try {
      const json = stripped.toUpperCase().startsWith("%7B") ? decodeURIComponent(stripped) : stripped;
      const obj = JSON.parse(json);
      if (obj?.id && ID_RE.test(String(obj.id))) return { by: "id", value: String(obj.id) };
      if (obj?.batchNumber && /^\d+$/.test(String(obj.batchNumber))) {
        return { by: "batchNumber", value: String(obj.batchNumber) };
      }
    } catch { /* ignore */ }
  }

  // 6) Last-resort heuristic: biggest 5+ digit run
  const bigNum = stripped.match(/\d{5,}/);
  if (bigNum) return { by: "batchNumber", value: bigNum[0] };

  return null;
}
