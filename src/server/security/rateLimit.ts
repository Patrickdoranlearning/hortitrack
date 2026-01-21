import { getSupabaseAdmin } from "@/server/db/supabase";
import * as Sentry from "@sentry/nextjs";

export interface Result {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export async function checkRateLimit(opts: { key: string; windowMs: number; max: number }): Promise<Result> {
  const { key, windowMs, max } = opts;
  const now = Date.now();
  const resetAt = now + windowMs;

  const supabase = getSupabaseAdmin();

  // 1. Clean up expired (optional, or run periodically)
  // await supabase.from('rate_limits').delete().lt('expire_at', now);

  // 2. Get current usage
  const { data: current } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  let points = current?.points || 0;
  let expireAt = current?.expire_at || resetAt;

  if (current && current.expire_at < now) {
    // Expired, reset
    points = 0;
    expireAt = resetAt;
  }

  // 3. Increment
  points++;

  // 4. Update/Insert
  const { error } = await supabase
    .from('rate_limits')
    .upsert({ key, points, expire_at: expireAt });

  if (error) {
    console.error("Rate limit error:", error);
    // Report to Sentry for monitoring - DB errors here could indicate infrastructure issues
    Sentry.captureException(error, {
      tags: { component: "rate-limit" },
      extra: { key, windowMs, max },
    });
    // Fail closed on DB error to prevent bypass attacks
    return { allowed: false, remaining: 0, resetMs: windowMs };
  }

  const allowed = points <= max;
  const remaining = Math.max(0, max - points);
  const resetMs = Math.max(0, expireAt - now);

  return { allowed, remaining, resetMs };
}

// Prefer user id; otherwise first XFF IP.
export function requestKey(req: Request, userId?: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || (req as any).ip || "unknown";
  return userId ? `user:${userId}` : `ip:${ip}`;
}
