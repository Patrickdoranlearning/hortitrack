import { createClient } from "@/lib/supabase/server";

export interface Result {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export async function checkRateLimit(opts: { key: string; windowMs: number; max: number }): Promise<Result> {
  const { key, windowMs, max } = opts;
  const now = Date.now();
  const resetAt = now + windowMs;

  const supabase = await createClient();

  // 1. Clean up expired (optional, or run periodically)
  // await supabase.from('rate_limits').delete().lt('expire_at', now);

  // 2. Get current usage
  const { data: current } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('key', key)
    .single();

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
    // Fail open if DB error
    return { allowed: true, remaining: 1, resetMs: 0 };
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
