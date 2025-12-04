export function isValidDocId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0 && !id.includes("/");
}
export function normalizeDocId(id: unknown): string | null {
  if (!isValidDocId(id)) return null;
  return id.trim();
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: simple random string
  return Math.random().toString(36).slice(2, 10);
}
