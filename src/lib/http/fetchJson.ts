export class HttpError extends Error {
  status: number;
  requestId?: string;
  body?: unknown;
  resetMs?: number; // For 429 rate limit responses
  constructor(message: string, status: number, requestId?: string, body?: unknown, resetMs?: number) {
    super(message);
    this.status = status;
    this.requestId = requestId;
    this.body = body;
    this.resetMs = resetMs;
  }
}

export class NetworkError extends Error {
  cause?: Error;
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  
  try {
    res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
    });
  } catch (error) {
    // Network-level errors (e.g., "Failed to fetch", offline, CORS, etc.)
    const cause = error instanceof Error ? error : undefined;
    const message = cause?.message || "Network request failed";
    
    // Provide more helpful error messages for common issues
    if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
      throw new NetworkError(
        "Unable to connect to the server. Please check your internet connection and try again.",
        cause
      );
    }
    if (message.includes("aborted")) {
      throw new NetworkError("Request was cancelled.", cause);
    }
    
    throw new NetworkError(`Network error: ${message}`, cause);
  }

  let text: string;
  try {
    text = await res.text();
  } catch (error) {
    throw new NetworkError("Failed to read server response.");
  }

  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Response is not JSON - might be an error page
    if (!res.ok) {
      throw new HttpError(
        `Server error (${res.status}): Invalid response format`,
        res.status,
        res.headers.get("x-request-id") || undefined,
        text
      );
    }
  }

  if (!res.ok) {
    const reqId = (data && typeof data === 'object' && ((data as Record<string, unknown>).requestId || (data as Record<string, unknown>).request_id)) || res.headers.get("x-request-id") || undefined;
    const message = (data && typeof data === 'object' && ((data as Record<string, unknown>).error || (data as Record<string, unknown>).message)) || `Request failed (${res.status})`;
    const resetMs = (data && typeof data === 'object' && (data as Record<string, unknown>).resetMs) as number | undefined;
    throw new HttpError(String(message), res.status, reqId as string | undefined, data, resetMs);
  }
  return data as T;
}
