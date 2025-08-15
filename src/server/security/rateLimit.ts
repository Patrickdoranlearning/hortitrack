ts
import { adminDb } from "@/server/db/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

/**
 * Fixed-window limiter per key (e.g., ip:1.2.3.4 or user:abc).
 * One doc per key; reset when window elapses.
 *
 * Firestore doc shape (collection: rateLimits):
 * {
 *   count: number,
 *   windowStart: Timestamp,
 *   expireAt: Timestamp   // enable TTL on this field to auto-clean docs
 * }
 */
export async function checkRateLimit(opts: {
  key: string;
  max: number;        // e.g., 60
  windowMs: number;   // e.g., 60_000
}): Promise<{
  allowed: boolean;
  remaining: number;
  resetMs: number;
}> {
  const { key, max, windowMs } = opts;
  const now = Date.now();
  const docRef = adminDb.collection("rateLimits").doc(key);

  return await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const start = snap.exists ? (snap.get("windowStart") as Timestamp).toMillis() : 0;
    const inWindow = now - start < windowMs;

    let count = 0;
    let windowStart = start;

    if (!snap.exists || !inWindow) {
      // new window
      count = 1;
      windowStart = now;
      tx.set(docRef, {
        count,
        windowStart: Timestamp.fromMillis(windowStart),
        // TTL ~ 2 windows after reset so Firestore can garbage-collect
        expireAt: Timestamp.fromMillis(windowStart + windowMs * 2),
      });
    } else {
      count = (snap.get("count") as number) + 1;
      tx.update(docRef, {
        count: FieldValue.increment(1),
        // bump expireAt forward to keep hot keys alive during active window
        expireAt: Timestamp.fromMillis(start + windowMs * 2),
      });
    }

    const allowed = count <= max;
    const resetMs = Math.max(0, windowMs - (now - windowStart));
    const remaining = Math.max(0, max - count);

    return { allowed, remaining, resetMs };
  });
}

// Small helper to extract an identifier
export function requestKey(req: Request, userId?: string) {
  // Prefer user id if authenticated; otherwise first XFF IP.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    (req as any).ip ||
    "unknown";
  return userId ? `user:${userId}` : `ip:${ip}`;
}