
// src/lib/security/origin.ts
import type { NextRequest } from "next/server";

function wildcardMatch(input: string, pattern: string) {
  if (!pattern.includes("*")) return input === pattern;
  const [pre, post] = pattern.split("*");
  return input.startsWith(pre) && input.endsWith(post);
}

export function isAllowedOrigin(req: NextRequest) {
  // Server Actions use a private wire protocol and special header.
  // If we block or rewrite them, Next.js client throws "Unexpected response".
  const isServerAction = req.headers.get("next-action") === "1";
  if (isServerAction) return true;

  const origin = (req.headers.get("origin") || "").toLowerCase();
  const host = (req.headers.get("host") || "").toLowerCase();
  const proto = req.nextUrl.protocol || "https:"; // dev often https on workstations
  const sameOrigin = `${proto}//${host}`;

  // 1) Always allow requests that are same-origin.
  // Some browsers omit the Origin header on same-origin POSTs; fall back to host match.
  if (!origin || origin === sameOrigin) return true;

  // 2) In development, allow common local hosts + workstations
  const devAllow = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost:3000",
    "https://127.0.0.1:3000",
    // Google Cloud Workstations (your current dev domain)
    "https://*.cloudworkstations.dev",
  ];

  if (process.env.NODE_ENV !== "production") {
    return devAllow.some((p) =>
      p.includes("*") ? wildcardMatch(origin, p) : origin === p
    );
  }

  // 3) In production, allow configured origins:
  // - NEXT_PUBLIC_APP_URL (canonical)
  // - ALLOWED_ORIGINS (comma-separated list, supports "*" wildcards)
  const allow: string[] = [];
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").toLowerCase();
  if (appUrl) allow.push(appUrl);
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  allow.push(...extra);

  return allow.some((p) => (p.includes("*") ? wildcardMatch(origin, p) : origin === p));
}
