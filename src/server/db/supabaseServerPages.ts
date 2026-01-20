// Pages Router / API Routes server client (no next/headers, no server-only)
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextApiRequest, NextApiResponse } from "next";
import type { GetServerSidePropsContext } from "next";
import type { ServerResponse, IncomingMessage } from "http";
import { serialize } from "cookie";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

// Common response type that works for both API routes and getServerSideProps
type ResponseLike = NextApiResponse | ServerResponse<IncomingMessage>;

type Ctx =
  | { req: NextApiRequest; res: NextApiResponse }
  | GetServerSidePropsContext;

/**
 * Usage (API Route):
 *   const supabase = getSupabaseServerPages({ req, res });
 *
 * Usage (getServerSideProps):
 *   export const getServerSideProps = async (ctx) => {
 *     const supabase = getSupabaseServerPages(ctx);
 *   }
 */
export function getSupabaseServerPages(ctx: Ctx) {
  const req = "req" in ctx ? ctx.req : (ctx as GetServerSidePropsContext).req;
  const res = "res" in ctx ? ctx.res : (ctx as GetServerSidePropsContext).res!;
  // Intentionally untyped: keep API routes resilient to schema/type drift.
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        // @ts-ignore - next types differ slightly between runtimes
        return req.cookies?.[name];
      },
      set(name: string, value: string, options: CookieOptions) {
        const header = serialize(name, value, cookieOpts(options));
        appendSetCookie(res, header);
      },
      remove(name: string, options: CookieOptions) {
        const header = serialize(name, "", cookieOpts({ ...options, maxAge: 0 }));
        appendSetCookie(res, header);
      },
    },
  });
}

function cookieOpts(options: CookieOptions): CookieOptions {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    ...options,
  };
}

function appendSetCookie(res: ResponseLike, header: string) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) {
    res.setHeader("Set-Cookie", header);
  } else if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", [...prev, header]);
  } else {
    res.setHeader("Set-Cookie", [String(prev), header]);
  }
}
