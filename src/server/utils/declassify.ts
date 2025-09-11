import { Timestamp, FieldValue } from "firebase-admin/firestore";

type Primitive = string | number | boolean | null;

export function declassify<T>(value: T): any {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  // FieldValue cannot be serialized; drop it
  if (value instanceof (FieldValue as any)) return null;
  if (Array.isArray(value)) return value.map((v) => declassify(v));
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as any)) {
      const dv = declassify(v as any);
      if (dv !== undefined) out[k] = dv;
    }
    return out;
  }
  return value as Primitive;
}
