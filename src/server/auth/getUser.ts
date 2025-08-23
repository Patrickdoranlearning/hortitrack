// src/server/auth/getUser.ts
import "server-only";
import { cookies, headers } from "next/headers";
import { adminAuth } from "@/server/db/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

export type ServerUser = DecodedIdToken & { uid: string };

function readBearer(): string | undefined {
  const h = headers();
  const auth = h.get("authorization") || h.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return undefined;
}

function readCookie(): string | undefined {
  const c = cookies();
  // Align with whatever you set on login
  return c.get("idToken")?.value || c.get("__session")?.value;
}

export async function getUser(): Promise<ServerUser> {
  const idToken = readBearer() ?? readCookie();
  if (!idToken) throw new Error("UNAUTHENTICATED");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  return decoded as ServerUser;
}

export async function getOptionalUser(): Promise<ServerUser | null> {
  try {
    return await getUser();
  } catch {
    return null;
  }
}