import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/server/db/admin";
import { allocateBatchNumber } from "@/server/services/batchNumber";
import { mapError } from "@/lib/validation";
// import { getUser } from "@/server/auth/getUser"; // optional

const CreateBatchSchema = z.object({
  category: z.string().min(1),
  plantFamily: z.string().min(1),
  plantVariety: z.string().min(1),
  // We keep plantingDate as ISO string to match your existing data shape
  plantingDate: z.string().optional(),
  initialQuantity: z.number().int().nonnegative(),
  // If omitted, we'll default quantity = initialQuantity
  quantity: z.number().int().nonnegative().optional(),
  status: z.enum([
    "Propagation",
    "Plugs/Liners",
    "Potted",
    "Ready for Sale",
    "Looking Good",
    "Archived",
  ]),
  location: z.string().min(1),
  size: z.string().min(1),
  supplier: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // const user = await getUser();
    const raw = await req.json();
    const parsed = CreateBatchSchema.parse(raw);

    const result = await adminDb.runTransaction(async (tx) => {
      const batchRef = adminDb.collection("batches").doc();
      const batchNumber = await allocateBatchNumber(tx);

      const nowServer = FieldValue.serverTimestamp();
      const nowIso = new Date().toISOString();
      const quantity = parsed.quantity ?? parsed.initialQuantity;

      const doc = {
        id: batchRef.id,
        batchNumber,                          // <- always generated on server
        category: parsed.category,
        plantFamily: parsed.plantFamily,
        plantVariety: parsed.plantVariety,
        plantingDate: parsed.plantingDate ?? nowIso, // keep as ISO to match UI
        initialQuantity: parsed.initialQuantity,
        quantity,
        status: parsed.status,
        location: parsed.location,
        size: parsed.size,
        supplier: parsed.supplier ?? null,
        createdAt: nowServer,
        updatedAt: nowServer,
        // Your UI reads a document-level logHistory array:
        logHistory: FieldValue.arrayUnion({
          id: `log_${Date.now()}_create`,
          type: "CREATE",
          note: `Created batch ${batchNumber} with ${quantity} units.`,
          date: nowIso,
        }),
        // createdBy: user.uid,
      };

      tx.set(batchRef, doc);
      return { id: batchRef.id, batchNumber };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    const { status, body } = mapError(e);
    return NextResponse.json(body, { status });
  }
}