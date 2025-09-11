// src/app/api/_health/firebase/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { mapFirebaseAdminError } from "@/server/errors";

export async function GET() {
  try {
    // Lightweight call; will attempt auth and fail fast if creds missing
    await adminDb.listCollections();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapFirebaseAdminError(e);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: 503 });
  }
}
