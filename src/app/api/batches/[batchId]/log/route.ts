
import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/server/db/admin";
import { mapError } from "@/lib/validation";

const LogSchema = z.object({
  type: z.enum([
    "Spaced","Move","Trimmed","Dumped","Weed",
    "Photo","Note","Flagged","Unflagged"
  ]),
  note: z.string().optional(),
  photoUrl: z.string().url().optional(),
  flag: z.object({
    reason: z.string().min(1),
    remedy: z.string().optional(),
    severity: z.enum(["low","medium","high"]).optional(),
  }).optional(),
  userId: z.string().optional(),
  userName: z.string().optional(),
}).strict();

export async function POST(req: Request, ctx: { params: { batchId: string } }) {
  try {
    const { batchId } = ctx.params;
    const json = await req.json();
    const parsed = LogSchema.parse(json);

    const ref = adminDb.collection("batches").doc(batchId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const logEntry = {
      type: parsed.type,
      note: parsed.note,
      photoUrl: parsed.photoUrl,
      userId: parsed.userId,
      userName: parsed.userName,
      at: now,
    };

    const updates: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
      logHistory: FieldValue.arrayUnion(logEntry),
    };

    if (parsed.type === "Flagged" && parsed.flag) {
      updates.flag = {
        active: true,
        reason: parsed.flag.reason,
        remedy: parsed.flag.remedy ?? "",
        severity: parsed.flag.severity ?? "medium",
        flaggedAt: now,
        flaggedBy: parsed.userName ?? parsed.userId ?? "system",
      };
    }
    if (parsed.type === "Unflagged") {
      updates.flag = {
        active: false,
        reason: "",
        remedy: "",
        severity: "low",
        flaggedAt: now,
        flaggedBy: parsed.userName ?? parsed.userId ?? "system",
      };
    }

    await ref.update(updates);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const { status, body } = mapError(e);
    return NextResponse.json(body, { status });
  }
}
