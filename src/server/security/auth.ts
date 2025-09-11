import type { NextRequest } from "next/server";
import { adminAuth } from "@/server/db/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

export async function getUserFromRequest(req: NextRequest): Promise<DecodedIdToken | null> {
  try {
    const h = req.headers.get("authorization") || "";
    const m = /^bearer\s+(.+)$/i.exec(h);
    const token = m?.[1]?.trim();
    if (!token) return null;
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}
