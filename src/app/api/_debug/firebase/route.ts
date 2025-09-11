export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getApps } from "firebase-admin/app";
import { getGcsBucket } from "@/server/db/admin";

export async function GET() {
  try {
    const app = getApps()[0];
    if (!app) {
        throw new Error("Firebase Admin SDK not initialized.");
    }
    let bucket: string | null = null;
    try { bucket = getGcsBucket().name; } catch { bucket = null; }
    return NextResponse.json({
      projectId: (app.options.projectId as string) || null,
      storageBucket: bucket,
      usingEmulator: !!process.env.FIRESTORE_EMULATOR_HOST,
      firestoreHost: process.env.FIRESTORE_EMULATOR_HOST || null,
      nodeEnv: process.env.NODE_ENV || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
