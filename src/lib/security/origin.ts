import type { NextRequest } from "next/server";

function wildcardMatch(input: string, pattern: string) {
  if (!pattern.includes("*")) return input === pattern;
  const [pre, post] = pattern.split("*");
  return input.startsWith(pre) && input.endsWith(post);
}

function toOrigin(host?: string, proto?: string) {
  if (!host) return "";
  const scheme = (proto && (proto === "https" || proto === "http")) ? proto : "https";
  return `${scheme}://${host}`.toLowerCase();
}

function buildAllowedOrigins(): string[] {
  const allow: string[] = [];
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  const appOrigin = appUrl ? (() => { try { return new URL(appUrl).origin; } catch { return appUrl; } })() : "";
  if (appOrigin) allow.push(appOrigin.toLowerCase());

  // Vercel preview/prod
  const vercelUrl = (process.env.VERCEL_URL || "").trim();
  if (vercelUrl) allow.push(toOrigin(vercelUrl, process.env.VERCEL ? "https" : undefined));

  // Explicit comma-sep allow list (supports wildcards)
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  allow.push(...extra);

  // Dev convenience (never used if NODE_ENV === "production")
  if (process.env.NODE_ENV !== "production") {
    allow.push("http://localhost:*", "http://127.0.0.1:*", "https://*.cloudworkstations.dev", "https://*.vercel.app");
  }
  return Array.from(new Set(allow));
}

export function isAllowedOrigin(req: NextRequest) {
  if ((req.headers.get("next-action") || "").trim() === "1") return true;
  const sfs = (req.headers.get("sec-fetch-site") || "").toLowerCase();
  if (sfs === "same-origin" || sfs === "same-site") return true;

  const originHeader = (req.headers.get("origin") || req.headers.get("referer") || "").toLowerCase();
  const hostHeader = (req.headers.get("host") || "").toLowerCase();
  const xfHost = (req.headers.get("x-forwarded-host") || "").toLowerCase();
  const xfProto = (req.headers.get("x-forwarded-proto") || "").toLowerCase();

  let originHost = "";
  let originOrigin = "";
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      originHost = parsed.host.toLowerCase();
      originOrigin = parsed.origin.toLowerCase();
    } catch {
      originOrigin = originHeader;
      originHost = originHeader.replace(/^https?:\/\//, "").split("/")[0];
    }
  }

  if (!originHost && hostHeader) {
    // No Origin header (likely same-origin SSR request); allow if host matches forwarded host/host
    originHost = hostHeader;
    originOrigin = toOrigin(hostHeader, xfProto);
  }

  if (!originHost && hostHeader && originHost === hostHeader) return true;
  if (originHost && xfHost && originHost === xfHost) return true;

  // Check against explicitly allowed origins (includes dev convenience origins in non-production)
  // NOTE: Removed blanket NODE_ENV !== 'production' bypass to protect staging/preview environments
  const allow = buildAllowedOrigins();
  const origin = originOrigin || originHeader;
  return allow.some((p) => (p.includes("*") ? wildcardMatch(origin, p) : origin === p));
}
