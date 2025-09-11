export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";

function csvEscape(val: unknown): string {
  // Convert to string, escape quotes, wrap in quotes if needed
  const s = val === null || val === undefined ? "" : String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 5000), 20000);
    
    let q = adminDb.collection("varieties").orderBy("name").limit(limit);

    const snap = await q.get();

    const header = [
      "id",
      "name",
      "family",
      "category",
      "grouping",
      "commonName",
      "rating",
      "salesPeriod",
      "floweringPeriod",
      "flowerColour",
      "evergreen",
      "updatedAt",
      "createdAt",
    ];

    const rows: string[] = [header.join(",")];

    for (const d of snap.docs) {
      const v = d.data() as any;
      rows.push([
        csvEscape(d.id),
        csvEscape(v.name ?? ""),
        csvEscape(v.family ?? ""),
        csvEscape(v.category ?? ""),
        csvEscape(v.grouping ?? ""),
        csvEscape(v.commonName ?? ""),
        csvEscape(v.rating ?? ""),
        csvEscape(v.salesPeriod ?? ""),
        csvEscape(v.floweringPeriod ?? ""),
        csvEscape(v.flowerColour ?? ""),
        csvEscape(v.evergreen ?? ""),
        csvEscape(v.updatedAt?.toDate ? v.updatedAt.toDate().toISOString() : v.updatedAt ?? ""),
        csvEscape(v.createdAt?.toDate ? v.createdAt.toDate().toISOString() : v.createdAt ?? ""),
      ].join(","));
    }

    const csv = rows.join("\n");
    const filename = `plant_varieties_${new Date().toISOString().slice(0,10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[varieties/export] error", e);
    return NextResponse.json({ error: "Failed to export plant varieties" }, { status: 500 });
  }
}
