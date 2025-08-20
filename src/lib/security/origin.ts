// src/lib/security/origin.ts
import type { NextRequest } from "next/server";

function wildcardMatch(input: string, pattern: string) {
  if (!pattern.includes("*")) return input === pattern;
  const [pre, post] = pattern.split("*");
  return input.startsWith(pre) && input.endsWith(post);
}

export function isAllowedOrigin(req: NextRequest) {
  // Next Server Actions: never block
  if ((req.headers.get("next-action") || "").trim() === "1") return true;

  // If browser declares same-origin / same-site, allow
  const sfs = (req.headers.get("sec-fetch-site") || "").toLowerCase();
  if (sfs === "same-origin" || sfs === "same-site") return true;

  const originHeader = (req.headers.get("origin") || req.headers.get("referer") || "").toLowerCase();
  const hostHeader = (req.headers.get("host") || "").toLowerCase();

  // No origin (curl, SSR fetch, some internal calls) => allow
  if (!originHeader) return true;

  let originHost = "";
  let originOrigin = "";
  try {
    const u = new URL(originHeader);
    originHost = u.host.toLowerCase();
    originOrigin = u.origin.toLowerCase();
  } catch {
    // keep empty; will be handled by dev/prod branches below
  }

  // Same-host shortcut
  if (originHost && hostHeader && originHost === hostHeader) return true;

  // In development/preview, be permissive
  if (process.env.NODE_ENV !== "production") return true;

  // Production allowlist
  const allow: string[] = [];
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").toLowerCase();
  if (appUrl) {
    try { allow.push(new URL(appUrl).origin); } catch { allow.push(appUrl); }
  }
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  allow.push(...extra);

  const origin = originOrigin || originHeader;
  return allow.some((p) => (p.includes("*") ? wildcardMatch(origin, p) : origin === p));
}
