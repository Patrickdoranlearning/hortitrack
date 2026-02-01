import { z } from "zod";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/server/security/auth";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { jsonError } from "./responses";
import type { UserSession } from "@/lib/types";
import { logger } from "@/server/utils/logger";

type GuardOpts<B extends z.ZodTypeAny | undefined = undefined> = {
  method: "GET"|"POST"|"PATCH"|"DELETE";
  bodySchema?: B;
  requireRole?: "admin" | "user";
  rate?: { max: number; windowMs: number; keyPrefix?: string };
  handler: (ctx: {
    req: NextRequest;
    user: UserSession | null;
    body: B extends z.ZodTypeAny ? z.infer<B> : undefined;
  }) => Promise<Response>;
};

export function withApiGuard<B extends z.ZodTypeAny | undefined>(opts: GuardOpts<B>) {
  return async (req: NextRequest) => {
    const started = Date.now();
    try {
      if (req.method !== opts.method) {
        return jsonError("Method Not Allowed", 405);
      }

      // Auth
      const user = await getUserFromRequest(req);
      if (opts.requireRole && !user) return jsonError("Unauthorized", 401);
      if (opts.requireRole && user && opts.requireRole === "admin" && user.role !== "admin") {
        return jsonError("Forbidden", 403);
      }

      // Rate limit (post-auth key preferred)
      if (opts.rate) {
        const key = `${opts.rate.keyPrefix ?? "api"}:${requestKey(req as any, user?.uid)}`;
        const res = await checkRateLimit({ key, max: opts.rate.max, windowMs: opts.rate.windowMs });
        if (!res.allowed) {
          return jsonError("Too many requests", {
            status: 429,
            details: { resetMs: res.resetMs },
          });
        }
      }

      // Validate body
      let body: any = undefined;
      if (opts.bodySchema) {
        const json = await req.json().catch(() => ({}));
        const parsed = opts.bodySchema.safeParse(json);
        if (!parsed.success) {
          return jsonError("Invalid input", {
            status: 422,
            details: parsed.error.flatten(),
          });
        }
        body = parsed.data;
      }

      const resp = await opts.handler({ req, user, body });
      return resp;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      logger.api.error("API error", e, { route: req.nextUrl.pathname, method: req.method });
      return jsonError("Internal Error", 500);
    } finally {
      const dur = Date.now() - started;
      logger.api.info("Request completed", { route: req.nextUrl.pathname, method: req.method, durationMs: dur });
    }
  };
}
