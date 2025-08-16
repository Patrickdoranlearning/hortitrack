
// src/server/scan/parse.ts
export type ParsedScan = { by: "id" | "batchNumber"; value: string } | null;

/** Normalize & parse any scan payload into a queryable key. */
export function parseScanCode(raw: string): ParsedScan {
  if (!raw) return null;

  // 0) Normalize
  if (raw.length > 512) return null; // guard
  const code = String(raw).trim().replace(/[\x1D\x1E\x1F]/g, ""); // strip GS/RS/US

  // 1) Preferred encodings
  let m = /^ht:batch:(\d+)$/i.exec(code);
  if (m) return { by: "batchNumber", value: m[1] };
  m = /^ht:id:([A-Za-z0-9_-]{15,})$/i.exec(code);
  if (m) return { by: "id", value: m[1] };

  // 1b) Legacy label: BATCH:<num>
  m = /^batch:(\d+)$/i.exec(code);
  if (m) return { by: "batchNumber", value: m[1] };

  // 2) Pure number or #1234
  m = /^(?:#)?(\d+)$/.exec(code);
  if (m) return { by: "batchNumber", value: m[1] };

  // 3) URL forms (…/batches/<id|num>?id=…&batch=…)
  try {
    const url = new URL(code);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p.toLowerCase() === "batches");
    if (idx >= 0 && parts[idx + 1]) {
      const val = parts[idx + 1];
      if (/^\d+$/.test(val)) return { by: "batchNumber", value: val };
      if (/^[A-Za-z0-9_-]{15,}$/.test(val)) return { by: "id", value: val };
    }
    const qpId = url.searchParams.get("id");
    if (qpId && /^[A-Za-z0-9_-]{15,}$/.test(qpId)) return { by: "id", value: qpId };
    const qpNum = url.searchParams.get("batchNumber") || url.searchParams.get("batch");
    if (qpNum && /^\d+$/.test(qpNum)) return { by: "batchNumber", value: qpNum };
  } catch {
    /* not a URL */
  }

  // 4) JSON {"id":"…"} or {"batchNumber":"123"}
  const looksJson = (code.startsWith("{") && code.endsWith("}")) || code.toUpperCase().startsWith("%7B");
  if (looksJson) {
    try {
      const json = code.toUpperCase().startsWith("%7B") ? decodeURIComponent(code) : code;
      const obj = JSON.parse(json);
      if (obj?.id && /^[A-Za-z0-9_-]{15,}$/.test(String(obj.id))) return { by: "id", value: String(obj.id) };
      if (obj?.batchNumber && /^\d+$/.test(String(obj.batchNumber))) return { by: "batchNumber", value: String(obj.batchNumber) };
    } catch {
      /* ignore */
    }
  }

  return null;
}
