export class HttpError extends Error {
  status: number;
  requestId?: string;
  body?: unknown;
  constructor(message: string, status: number, requestId?: string, body?: unknown) {
    super(message);
    this.status = status;
    this.requestId = requestId;
    this.body = body;
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const reqId = (data && (data.requestId || data.request_id)) || res.headers.get("x-request-id") || undefined;
    const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new HttpError(message, res.status, reqId, data);
  }
  return data as T;
}
