ts
import { cookies, headers } from "next/headers";
import { adminAuth } from "@/server/db/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

export async function getUser(): Promise<DecodedIdToken> {
  const h = headers();
  const authz = h.get("authorization") || "";
  const bearer = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  const token = bearer || cookies().get("__session")?.value;
  if (!token) throw Object.assign(new Error("Unauthorized"), { code: "UNAUTHORIZED" });

  try {
    return await adminAuth.verifyIdToken(token, true);
  } catch {
    throw Object.assign(new Error("Unauthorized"), { code: "UNAUTHORIZED" });
  }
}