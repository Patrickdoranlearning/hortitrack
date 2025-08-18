export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { env } from "@/env";

export async function GET() {
  const checks: Record<string, unknown> = {
    ok: true,
    projectIdPresent: !!env.FIREBASE_PROJECT_ID,
  };
  try {
    // lightweight read (no writes)
    await adminDb.collection("_health").limit(1).get();
    checks.firestore = "ok";
  } catch (e: any) {
    checks.firestore = `error: ${e?.message || e}`;
  }
  return NextResponse.json(checks, { status: 200 });
}
