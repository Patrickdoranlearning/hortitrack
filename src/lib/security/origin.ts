// src/lib/security/origin.ts
import type { NextRequest } from "next/server";

function wildcardMatch(input: string, pattern: string) {
  if (!pattern.includes("*")) return input === pattern;
  const [pre, post] = pattern.split("*");
  return input.startsWith(pre) && input.endsWith(post);
}

export function isAllowedOrigin(req: NextRequest) {
  // 0) Server Actions must pass (Next private wire)
  if (req.headers.get("next-action") === "1") return true;

  // 1) Derive origin + host
  const originHeader = (req.headers.get("origin") || req.headers.get("referer") || "").toLowerCase();
  const hostHeader = (req.headers.get("host") || "").toLowerCase();

  // If no origin header (e.g., curl), allow — there's no CSRF vector without a browser origin
  if (!originHeader) return true;

  // Parse origin to compare hosts
  let originHost = "";
  let originOrigin = "";
  try {
    const u = new URL(originHeader);
    originHost = u.host.toLowerCase();
    originOrigin = u.origin.toLowerCase();
  } catch {
    // If it's not a URL, be conservative and deny later unless in dev
  }

  // 2) Always allow same-host requests (safe for CSRF purposes here)
  if (originHost && hostHeader && originHost === hostHeader) return true;

  // 3) In non-production, be permissive to unblock dev/preview environments
  if (process.env.NODE_ENV !== "production") return true;

  // 4) Production: allow only configured origins (supports "*" wildcards)
  const allow: string[] = [];
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").toLowerCase();
  if (appUrl) {
    try {
      allow.push(new URL(appUrl).origin);
    } catch {
      allow.push(appUrl);
    }
  }
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  allow.push(...extra);

  const origin = originOrigin || originHeader;
  return allow.some((p) => (p.includes("*") ? wildcardMatch(origin, p) : origin === p));
}
