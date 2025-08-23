// src/server/auth/getUser.ts
import "server-only";
import { cookies, headers } from "next/headers";
import { adminAuth } from "@/server/db/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

export type ServerUser = DecodedIdToken & { uid: string };

function readBearer(): string | undefined {
  const h = headers();
  const auth = h.get("authorization") ?? h.get("Authorization");
  if (!auth) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m?.[1]?.trim();
}

function readCookie(): string | undefined {
  // Firebase Hosting/Functions convention
  return cookies().get("__session")?.value;
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