// src/lib/security/origin.ts
import type { NextRequest } from "next/server";

function wildcardMatch(input: string, pattern: string) {
  if (!pattern.includes("*")) return input === pattern;
  const [pre, post] = pattern.split("*");
  return input.startsWith(pre) && input.endsWith(post);
}

export function isAllowedOrigin(req: NextRequest) {
  const origin = (req.headers.get("origin") || "").toLowerCase();
  const host = (req.headers.get("host") || "").toLowerCase();
  const proto = req.nextUrl.protocol || "https:"; // dev often https on workstations
  const sameOrigin = `${proto}//${host}`;

  // 1) Always allow requests that are same-origin
  if (!origin || origin === sameOrigin) return true;

  // 2) Dev-friendly hosts
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

  // 3) In production, only allow exact same‑origin
  return false;
}
