import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function GET() {
  const snap = await db.collection("locations").get();
  const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).map(l => ({ id: l.id, name: l.name }));
  return NextResponse.json({ items });
}
