import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const snap = await db.collection("locations").get();
    const items = snap.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, name: data.name, code: data.code ?? null };
    });
    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    console.error("[api/locations] 500", e);
    return NextResponse.json({ items: [], error: e?.message || "Failed to fetch locations" }, { status: 500 });
  }
}
