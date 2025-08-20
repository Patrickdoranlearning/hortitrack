
export async function postJson<T = any>(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body, (_, v) => (v === undefined ? undefined : v)),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch {}
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const msg = data?.error || data?.message || (ct.includes("text/html") ? `HTTP ${res.status} (HTML)` : `HTTP ${res.status}`);
    return { ok: false as const, status: res.status, error: msg, data, text };
  }
  return { ok: true as const, status: res.status, data: (data as T), text };
}
