// Central helpers to avoid "[object Object]" everywhere.

export function toMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || String(err);
  try {
    // Common Next/ServerAction objects or zod errors
    if (typeof err === "object") {
      // surface common fields if present
      const anyErr = err as any;
      if (anyErr.error && typeof anyErr.error === "string") return anyErr.error;
      if (anyErr.message && typeof anyErr.message === "string") return anyErr.message;
      return JSON.stringify(anyErr);
    }
    return String(err);
  } catch {
    return String(err);
  }
}

export function ensureError(e: unknown): Error {
  if (e instanceof Error) return e;
  try {
    return new Error(toMessage(e));
  } catch {
    return new Error("Unknown error");
  }
}