// src/server/auth/token.ts
function b64urlToUtf8(b64url: string): string {
  // Pad and replace URL-safe chars
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  // Prefer atob (Edge), fallback to Buffer (Node)
  if (typeof atob === "function") return decodeURIComponent(escape(atob(b64)));
  // @ts-ignore
  return require("node:buffer").Buffer.from(b64, "base64").toString("utf8");
}

export function getBearerToken(req: Request): string | undefined {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1];
}

export function getUserIdFromJWT(token: string): string | undefined {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return undefined;
    const json = b64urlToUtf8(payloadPart);
    const payload = JSON.parse(json);
    return (payload?.sub as string) || undefined;
  } catch {
    return undefined;
  }
}
