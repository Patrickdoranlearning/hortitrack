import { NextResponse } from "next/server";
import { getUser } from "@/server/auth/getUser";
import { whoami } from "@/server/services/whoami.service";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { mapError } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    // Pre-auth IP throttle (very light)
    {
      const key = requestKey(req, undefined); // ip:<addr>
      const { allowed, remaining, resetMs } = await checkRateLimit({
        key, max: 30, windowMs: 60_000,
      });
      if (!allowed) {
        return new NextResponse("Too Many Requests", {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(resetMs / 1000).toString(),
            "X-RateLimit-Limit": "30",
            "X-RateLimit-Remaining": remaining.toString(),
          },
        });
      }
    }

    // Auth + per-user throttle
    const user = await getUser();
    const key = requestKey(req, user.uid);

    const { allowed, remaining, resetMs } = await checkRateLimit({
      key,
      max: 60,          // 60 req/min per user
      windowMs: 60_000,
    });

    if (!allowed) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(resetMs / 1000).toString(),
          "X-RateLimit-Limit": "60",
          "X-RateLimit-Remaining": remaining.toString(),
        },
      });
    }

    const data = await whoami(user);
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "X-RateLimit-Limit": "60",
        "X-RateLimit-Remaining": remaining.toString(),
      },
    });
  } catch (e: any) {
    const { status, body } = mapError(e);
    return NextResponse.json(body, { status });
  }
}
