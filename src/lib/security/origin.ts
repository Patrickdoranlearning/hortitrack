
import type { NextRequest } from "next/server";

function wildcardMatch(input: string, pattern: string) {
  if (!pattern.includes("*")) return input === pattern;
  const [pre, post] = pattern.split("*");
  return input.startsWith(pre) && input.endsWith(post);
}

export function isAllowedOrigin(req: NextRequest) {
  if ((req.headers.get("next-action") || "").trim() === "1") return true;
  const sfs = (req.headers.get("sec-fetch-site") || "").toLowerCase();
  if (sfs === "same-origin" || sfs === "same-site") return true;

  const originHeader = (req.headers.get("origin") || req.headers.get("referer") || "").toLowerCase();
  const hostHeader = (req.headers.get("host") || "").toLowerCase();

  if (!originHeader) return true;

  let originHost = "", originOrigin = "";
  try { const u = new URL(originHeader); originHost = u.host.toLowerCase(); originOrigin = u.origin.toLowerCase(); } catch {}

  if (originHost && hostHeader && originHost === hostHeader) return true;
  if (process.env.NODE_ENV !== "production") return true;

  const allow: string[] = [];
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").toLowerCase();
  if (appUrl) { try { allow.push(new URL(appUrl).origin); } catch { allow.push(appUrl); } }
  const extra = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  allow.push(...extra);
  const origin = originOrigin || originHeader;
  return allow.some((p) => (p.includes("*") ? wildcardMatch(origin, p) : origin === p));
}
