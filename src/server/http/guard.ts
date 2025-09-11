import { z } from "zod";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/server/security/auth";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";

type GuardOpts<B extends z.ZodTypeAny | undefined = undefined> = {
  method: "GET"|"POST"|"PATCH"|"DELETE";
  bodySchema?: B;
  requireRole?: "admin" | "user";
  rate?: { max: number; windowMs: number; keyPrefix?: string };
  handler: (ctx: {
    req: NextRequest;
    user: import("firebase-admin/auth").DecodedIdToken | null;
    body: B extends z.ZodTypeAny ? z.infer<B> : undefined;
  }) => Promise<Response>;
};

export function withApiGuard<B extends z.ZodTypeAny | undefined>(opts: GuardOpts<B>) {
  return async (req: NextRequest) => {
    const started = Date.now();
    try {
      if (req.method !== opts.method) {
        return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
      }

      // Auth
      const user = await getUserFromRequest(req);
      if (opts.requireRole && !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (opts.requireRole && user && opts.requireRole === "admin" && (user as any).role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Rate limit (post-auth key preferred)
      if (opts.rate) {
        const key = `${opts.rate.keyPrefix ?? "api"}:${requestKey(req as any, user?.uid)}`;
        const res = await checkRateLimit({ key, max: opts.rate.max, windowMs: opts.rate.windowMs });
        if (!res.allowed) {
          return NextResponse.json({ error: "Too many requests", resetMs: res.resetMs }, { status: 429 });
        }
      }

      // Validate body
      let body: any = undefined;
      if (opts.bodySchema) {
        const json = await req.json().catch(() => ({}));
        const parsed = opts.bodySchema.safeParse(json);
        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
        }
        body = parsed.data;
      }

      const resp = await opts.handler({ req, user, body });
      return resp;
    } catch (e: any) {
      console.error("api_error", { route: req.nextUrl.pathname, method: req.method, msg: e?.message });
      return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    } finally {
      const dur = Date.now() - started;
      console.log("api_done", { route: req.nextUrl.pathname, method: req.method, ms: dur });
    }
  };
}
