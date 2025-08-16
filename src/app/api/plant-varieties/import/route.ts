
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { parse } from "csv-parse/sync";
import { FieldValue } from "firebase-admin/firestore";
import type { Variety } from "@/lib/types";

type Row = Partial<Variety> & { id?: string };

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const dryRun = (form.get("dryRun") ?? "false").toString() === "true";
    const upsertBy = (form.get("upsertBy") ?? "id").toString(); // "id" | "name"

    if (!file) return NextResponse.json({ error: "CSV file is required (form field 'file')" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const text = buf.toString("utf8");

    const records: Row[] = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const results: Array<{ index: number; id?: string; name?: string; op?: "create" | "update"; error?: string }> = [];
    const batch = adminDb.batch();

    for (let i = 0; i < records.length; i++) {
      const r = records[i] || {};
      const name = (r.name ?? "").toString().trim();
      const id = (r.id ?? "").toString().trim();
      
      if (!name && upsertBy === "name") {
        results.push({ index: i, error: "Missing 'name' (required for upsertBy=name)" });
        continue;
      }

      let docRef = null;
      if (upsertBy === "id") {
        if (!id) {
          results.push({ index: i, name, error: "Missing 'id' (upsertBy=id)" });
          continue;
        }
        docRef = adminDb.collection("varieties").doc(id);
      } else {
        // upsert by name: find existing doc by name
        const qs = await adminDb.collection("varieties").where("name", "==", name).limit(1).get();
        docRef = qs.empty ? adminDb.collection("varieties").doc() : qs.docs[0].ref;
      }
      
      const payload: Omit<Variety, 'id'> = {
          name,
          family: (r.family ?? "").toString().trim() || "",
          category: (r.category ?? "").toString().trim() || "",
          grouping: (r.grouping ?? "").toString().trim() || undefined,
          commonName: (r.commonName ?? "").toString().trim() || undefined,
          rating: (r.rating ?? "").toString().trim() || undefined,
          salesPeriod: (r.salesPeriod ?? "").toString().trim() || undefined,
          floweringPeriod: (r.floweringPeriod ?? "").toString().trim() || undefined,
          flowerColour: (r.flowerColour ?? "").toString().trim() || undefined,
          evergreen: (r.evergreen ?? "").toString().trim() || undefined,
      };

      const existing = await docRef.get();
      if (existing.exists) {
        results.push({ index: i, id: docRef.id, name, op: "update" });
        if (!dryRun) batch.set(docRef, { ...payload, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      } else {
        results.push({ index: i, id: docRef.id, name, op: "create" });
        if (!dryRun) batch.set(docRef, { ...payload, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    }

    if (!dryRun) await batch.commit();

    const summary = {
      total: records.length,
      created: results.filter(r => r.op === "create").length,
      updated: results.filter(r => r.op === "update").length,
      errors: results.filter(r => r.error).length,
    };

    return NextResponse.json({ ok: true, summary, results });
  } catch (e: any) {
    console.error("[varieties/import] error", e);
    return NextResponse.json({ error: "Failed to import CSV", details: e?.message }, { status: 500 });
  }
}
