export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getGcsBucket } from "@/server/db/admin";

export async function GET() {
  try {
    const b = getGcsBucket();
    const [exists] = await b.exists();
    return NextResponse.json({ bucket: b.name, exists });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 503 });
  }
}
