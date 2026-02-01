/**
 * Worker API Route Guard
 *
 * Standardized wrapper for worker app API routes that provides:
 * - Authentication via getUserAndOrg()
 * - Rate limiting (configurable, default 100 req/min)
 * - Request body validation via Zod schemas
 * - Consistent error responses
 * - Structured logging
 *
 * Usage:
 *   import { withWorkerGuard } from '@/server/http/worker-guard';
 *
 *   export const GET = withWorkerGuard({
 *     method: "GET",
 *     handler: async ({ req, user, orgId, supabase }) => {
 *       // Your handler code here
 *       return NextResponse.json({ data: "..." });
 *     }
 *   });
 *
 *   // With body validation:
 *   export const POST = withWorkerGuard({
 *     method: "POST",
 *     bodySchema: z.object({ name: z.string() }),
 *     handler: async ({ req, user, orgId, supabase, body }) => {
 *       // body is typed and validated
 *       return NextResponse.json({ name: body.name });
 *     }
 *   });
 */

import { z } from "zod";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { logger } from "@/server/utils/logger";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Rate limit configuration */
interface RateLimitConfig {
  /** Maximum requests allowed in window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/** Default rate limit: 100 requests per minute */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  max: 100,
  windowMs: 60_000,
};

/** Context passed to the route handler */
export interface WorkerGuardContext<B = undefined> {
  /** The original Next.js request */
  req: NextRequest;
  /** The authenticated Supabase user */
  user: User;
  /** The user's active organization ID - use in all queries! */
  orgId: string;
  /** Supabase admin client (bypasses RLS - always filter by orgId) */
  supabase: SupabaseClient;
  /** Validated request body (if bodySchema was provided) */
  body: B;
  /** Route parameters from URL (e.g., [id]) */
  params: Record<string, string>;
}

/** Options for configuring the worker guard */
export interface WorkerGuardOptions<B extends z.ZodTypeAny | undefined = undefined> {
  /** HTTP method this handler accepts */
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Optional Zod schema for request body validation */
  bodySchema?: B;
  /** Optional custom rate limit configuration */
  rate?: RateLimitConfig;
  /** The route handler function */
  handler: (
    ctx: WorkerGuardContext<B extends z.ZodTypeAny ? z.infer<B> : undefined>
  ) => Promise<Response>;
}

/**
 * Creates a guarded worker API route handler.
 *
 * @param opts - Configuration options for the guard
 * @returns A Next.js route handler function
 *
 * @example
 * // Simple GET handler
 * export const GET = withWorkerGuard({
 *   method: "GET",
 *   handler: async ({ orgId, supabase }) => {
 *     const { data } = await supabase
 *       .from("batches")
 *       .select("*")
 *       .eq("org_id", orgId);
 *     return NextResponse.json({ items: data });
 *   }
 * });
 *
 * @example
 * // POST with body validation
 * const CreateSchema = z.object({
 *   name: z.string().min(1),
 *   quantity: z.number().positive(),
 * });
 *
 * export const POST = withWorkerGuard({
 *   method: "POST",
 *   bodySchema: CreateSchema,
 *   handler: async ({ orgId, supabase, body }) => {
 *     // body is typed as { name: string; quantity: number }
 *     const { data, error } = await supabase
 *       .from("items")
 *       .insert({ ...body, org_id: orgId })
 *       .select()
 *       .single();
 *
 *     if (error) throw error;
 *     return NextResponse.json({ item: data });
 *   }
 * });
 */
export function withWorkerGuard<B extends z.ZodTypeAny | undefined = undefined>(
  opts: WorkerGuardOptions<B>
) {
  return async (
    req: NextRequest,
    routeContext?: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    const started = Date.now();
    const route = req.nextUrl.pathname;
    const method = req.method;

    try {
      // 1. Method validation
      if (method !== opts.method) {
        return NextResponse.json(
          { ok: false, error: "Method Not Allowed" },
          { status: 405 }
        );
      }

      // 2. Authentication - getUserAndOrg throws if not authenticated
      const { user, orgId, supabase } = await getUserAndOrg();

      // 3. Rate limiting
      const rateConfig = opts.rate ?? DEFAULT_RATE_LIMIT;
      const rateLimitKey = `worker:${requestKey(req, user.id)}`;

      const rateLimitResult = await checkRateLimit({
        key: rateLimitKey,
        max: rateConfig.max,
        windowMs: rateConfig.windowMs,
      });

      if (!rateLimitResult.allowed) {
        logger.worker.warn("Rate limit exceeded", {
          userId: user.id,
          route,
          remaining: rateLimitResult.remaining,
          resetMs: rateLimitResult.resetMs,
        });

        return NextResponse.json(
          {
            ok: false,
            error: "Too many requests",
            resetMs: rateLimitResult.resetMs,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil(rateLimitResult.resetMs / 1000)),
              "X-RateLimit-Remaining": String(rateLimitResult.remaining),
              "X-RateLimit-Reset": String(rateLimitResult.resetMs),
            },
          }
        );
      }

      // 4. Body validation (for POST/PATCH/PUT)
      let body: z.infer<NonNullable<B>> | undefined = undefined;

      if (opts.bodySchema) {
        try {
          const rawBody = await req.json();
          const parseResult = opts.bodySchema.safeParse(rawBody);

          if (!parseResult.success) {
            return NextResponse.json(
              {
                ok: false,
                error: "Invalid request body",
                details: parseResult.error.flatten(),
              },
              { status: 400 }
            );
          }

          body = parseResult.data;
        } catch {
          return NextResponse.json(
            { ok: false, error: "Invalid JSON body" },
            { status: 400 }
          );
        }
      }

      // 5. Resolve route params
      const params = routeContext?.params ? await routeContext.params : {};

      // 6. Execute handler
      const response = await opts.handler({
        req,
        user,
        orgId,
        supabase,
        body: body as B extends z.ZodTypeAny ? z.infer<B> : undefined,
        params,
      });

      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Handle authentication errors
      if (/unauthenticated/i.test(errorMessage)) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 }
        );
      }

      // Log unexpected errors
      logger.worker.error("Worker API error", error, {
        route,
        method,
      });

      return NextResponse.json(
        { ok: false, error: "Internal server error" },
        { status: 500 }
      );
    } finally {
      // Log request completion
      const duration = Date.now() - started;
      logger.worker.info("Request completed", {
        route,
        method,
        durationMs: duration,
      });
    }
  };
}

/**
 * Type helper for extracting the context type from a guard configuration
 */
export type ExtractWorkerContext<T> = T extends WorkerGuardOptions<infer B>
  ? WorkerGuardContext<B extends z.ZodTypeAny ? z.infer<B> : undefined>
  : never;
