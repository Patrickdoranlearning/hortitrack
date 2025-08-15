// src/server/utils/declassify.ts
export function declassify(value: any): any {
  if (value == null) return value;

  // 1) Firestore Timestamp instance (admin or client)
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch {
      // fall through
    }
  }

  // 2) Plain objects that look like timestamps
  const maybeObj = value as any;
  const hasUnderscore = maybeObj && maybeObj._seconds != null && maybeObj._nanoseconds != null;
  const hasNoUnderscore = maybeObj && maybeObj.seconds != null && maybeObj.nanoseconds != null;
  if (hasUnderscore || hasNoUnderscore) {
    const sec = maybeObj._seconds ?? maybeObj.seconds ?? 0;
    const ns = maybeObj._nanoseconds ?? maybeObj.nanoseconds ?? 0;
    return new Date(sec * 1000 + Math.floor(ns / 1e6)).toISOString();
  }

  // 3) Date
  if (value instanceof Date) return value.toISOString();

  // 4) GeoPoint-like (turn into plain lat/lng)
  if (maybeObj?.latitude != null && maybeObj?.longitude != null && typeof maybeObj.isEqual === 'function') {
    return { lat: maybeObj.latitude, lng: maybeObj.longitude };
  }

  // 5) Arrays: recurse
  if (Array.isArray(value)) return value.map(declassify);

  // 6) Objects: recurse into fields and produce a plain object (no custom proto)
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = declassify(v);
    return out;
  }

  return value;
}