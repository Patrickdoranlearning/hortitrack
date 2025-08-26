// src/lib/http.ts
export async function readJson<T = any>(res: Response): Promise<T | null> {
  // Read the body once; JSON.parse only if non-empty.
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Helpful error for HTML or unexpected content
    const preview = text.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`Expected JSON (status ${res.status}); got: ${preview}`);
  }
}

export async function fetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ data: T | null; res: Response }> {
  const res = await fetch(input, init);
  let data: T | null = null;
  try {
    data = await readJson<T>(res);
  } catch (e) {
    // If parse fails on success, throw; on failure we’ll still provide context
    if (res.ok) throw e;
  }

  if (!res.ok) {
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const message =
      (data as any)?.error ||
      (data as any)?.message ||
      (ct.includes("text/html") ? `HTTP ${res.status} (HTML)` : `HTTP ${res.status}`);
    const err = new Error(message) as Error & { status?: number; data?: any };
    err.status = res.status;
    (err as any).data = data;
    throw err;
  }

  return { data, res };
}
