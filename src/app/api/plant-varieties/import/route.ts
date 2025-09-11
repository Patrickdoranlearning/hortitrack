export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { parse } from "csv-parse/sync";
import { FieldValue } from "firebase-admin/firestore";
import type { Variety } from "@/lib/types";

const normName = (s: any) => (typeof s === "string" ? s.trim().toLowerCase() : "");

type Row = Partial<Variety> & { id?: string };

function normBool(v: any): boolean | null {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "t", "1", "yes", "y"].includes(s)) return true;
      if (["false", "f", "0", "no", "n"].includes(s)) return false;
    }
    return null;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const dryRun = (form.get("dryRun") ?? "false").toString() === "true";
    const upsertBy = (form.get("upsertBy") ?? "name").toString(); // default: name

    if (!file) return NextResponse.json({ error: "CSV file is required (form field 'file')" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const text = buf.toString("utf8");

    const records: Row[] = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const results: Array<{ index: number; id?: string; name?: string; op?: "create" | "update"; error?: string; matchedBy?: "id" | "name" }> = [];
    const batch = adminDb.batch();

    for (let i = 0; i < records.length; i++) {
      const r = records[i] || {};
      const name = (r.name ?? "").toString().trim();
      const id = (r.id ?? "").toString().trim();
      
      if (upsertBy === "name" && !name) {
        results.push({ index: i, error: "Missing 'name' (required for upsertBy=name)" });
        continue;
      }

      let docRef;
      let matchedBy: "id" | "name" = "name";

      if (upsertBy === "id") {
        if (!id) {
          results.push({ index: i, name, error: "Missing 'id' (upsertBy=id)" });
          continue;
        }
        docRef = adminDb.collection("varieties").doc(id);
        matchedBy = "id";
      } else {
        const lower = normName(name);
        let qs = await adminDb.collection("varieties").where("nameLower", "==", lower).limit(2).get();
        if (qs.size > 1) {
            results.push({ index: i, name, error: "Multiple existing varieties match this name (case-insensitive). Please resolve duplicates." });
            continue;
        }
        if (qs.empty) {
            qs = await adminDb.collection("varieties").where("name", "==", name).limit(1).get();
        }
        docRef = qs.empty ? adminDb.collection("varieties").doc() : qs.docs[0].ref;
      }
      
      const payload: Omit<Variety, 'id'> & { nameLower: string } = {
          name,
          nameLower: normName(name),
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
        results.push({ index: i, id: docRef.id, name, op: "update", matchedBy });
        if (!dryRun) batch.set(docRef, { ...payload, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      } else {
        results.push({ index: i, id: docRef.id, name, op: "create", matchedBy });
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
