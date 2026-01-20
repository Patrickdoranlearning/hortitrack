type Primitive = string | number | boolean | null;

type TimestampLike = { toDate: () => Date };

function isTimestampLike(value: unknown): value is TimestampLike {
  return (
    value != null &&
    typeof value === "object" &&
    typeof (value as TimestampLike).toDate === "function"
  );
}

type DeclassifyResult = Primitive | Primitive[] | Record<string, unknown> | DeclassifyResult[] | null;

export function declassify<T>(value: T): DeclassifyResult {
  if (value === undefined || value === null) return null;

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }

  if (isTimestampLike(value)) {
    try {
      const date = value.toDate();
      return Number.isFinite(date.getTime()) ? date.toISOString() : null;
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => declassify(item));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      const normalized = declassify(inner);
      if (normalized !== undefined) {
        out[key] = normalized;
      }
    }
    return out;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  return null;
}
