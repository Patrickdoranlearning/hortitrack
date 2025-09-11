// src/app/api/cron/passports/expire/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { switchPassportToInternal } from "@/server/batches/service";

const WEEKS12_MS = 1000 * 60 * 60 * 24 * 7 * 12;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const cutoffISO = new Date(now - WEEKS12_MS).toISOString();

  // Find check-in batches that still have Supplier passport and are older than cutoff
  const q = adminDb
    .collection("batches")
    .where("currentPassport.source", "==", "Supplier")
    .where("incomingDate", "<=", cutoffISO)
    .limit(50);

  const snap = await q.get();
  for (const doc of snap.docs) {
    await switchPassportToInternal(doc.id, "system-cron");
  }
  return NextResponse.json({ processed: snap.size });
}
