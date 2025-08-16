export function isValidDocId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0 && !id.includes("/");
}
export function normalizeDocId(id: unknown): string | null {
  if (!isValidDocId(id)) return null;
  return id.trim();
}
