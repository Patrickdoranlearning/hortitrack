import { adminDb } from "@/server/db/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

type Result = { allowed: boolean; remaining: number; resetMs: number };

export async function checkRateLimit(opts: { key: string; windowMs: number; max: number }): Promise<Result> {
  const { key, windowMs, max } = opts;
  const now = Date.now();
  const windowStart = new Date(now - (now % windowMs)); // align to window
  const resetAt = +windowStart + windowMs;

  const ref = adminDb.collection("rateLimits").doc(key);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      tx.set(ref, {
        count: 1,
        windowStart: Timestamp.fromDate(new Date(+windowStart)),
        expireAt: Timestamp.fromMillis(resetAt + 5 * 60_000), // TTL buffer
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { allowed: true, remaining: Math.max(0, max - 1), resetMs: Math.max(0, resetAt - now) };
    }

    const data = snap.data() || {};
    const start: Timestamp = data.windowStart;
    const count: number = data.count ?? 0;

    // New window?
    if (!start || start.toMillis() !== +windowStart) {
      tx.set(
        ref,
        {
          count: 1,
          windowStart: Timestamp.fromMillis(+windowStart),
          expireAt: Timestamp.fromMillis(resetAt + 5 * 60_000),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { allowed: true, remaining: Math.max(0, max - 1), resetMs: Math.max(0, resetAt - now) };
    }

    const next = (count || 0) + 1;
    const allowed = next <= max;
    tx.set(
      ref,
      { count: next, updatedAt: FieldValue.serverTimestamp(), expireAt: Timestamp.fromMillis(resetAt + 5 * 60_000) },
      { merge: true }
    );

    return { allowed, remaining: Math.max(0, max - next), resetMs: Math.max(0, resetAt - now) };
  });
}

// Prefer user id; otherwise first XFF IP.
export function requestKey(req: Request, userId?: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || (req as any).ip || "unknown";
  return userId ? `user:${userId}` : `ip:${ip}`;
}
