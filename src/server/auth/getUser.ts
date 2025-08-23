import "server-only";
import { cookies, headers } from "next/headers";
import { adminAuth } from "@/server/db/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

export type ServerUser = DecodedIdToken & { uid: string };

function readBearerFromHeaders(): string | undefined {
  const h = headers();
  const auth = h.get("authorization") || h.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return undefined;
}

function readTokenFromCookies(): string | undefined {
  const c = cookies();
  // Prefer an explicit cookie name if you set one in your client auth flow
  return c.get("idToken")?.value || c.get("__session")?.value;
}

export async function getUser(): Promise<ServerUser> {
  const idToken = readBearerFromHeaders() ?? readTokenFromCookies();
  if (!idToken) throw new Error("UNAUTHENTICATED");
  if (!adminAuth) throw new Error("AUTH_NOT_INITIALIZED");

  // verifyIdToken with checkRevoked=true (revocation respected if you use session cookies)
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  return decoded as ServerUser;
}

// Convenience: returns null instead of throwing
export async function getOptionalUser(): Promise<ServerUser | null> {
  try {
    return await getUser();
  } catch {
    return null;
  }
}
