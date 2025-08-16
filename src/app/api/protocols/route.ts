
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const variety = searchParams.get("variety");
  const family = searchParams.get("family");
  const limit = Math.min(Number(searchParams.get("limit") || 25), 100);

  try {
    let q = adminDb.collection("protocols").orderBy("createdAt", "desc").limit(limit);
    if (variety) q = q.where("plantVariety", "==", variety);
    if (family) q = q.where("plantFamily", "==", family);
    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ protocols: items });
  } catch (e) {
    console.error("protocol list error", e);
    return NextResponse.json({ error: "Failed to list protocols" }, { status: 500 });
  }
}
