import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/server/db/admin";
import { allocateBatchNumber } from "@/server/services/batchNumber";
import { mapError } from "@/lib/validation";
// If you protect this route, uncomment:
// import { getUser } from "@/server/auth/getUser";

/**
 * Body accepted from TransplantForm.
 * We copy category/family/variety from the source batch (authoritative).
 * New size/location/status come from the form.
 */
const TransplantSchema = z.object({
  quantity: z.number().int().positive("Quantity must be at least 1"),
  location: z.string().min(1, "Location is required"),
  size: z.string().min(1, "Size is required"),
  status: z.enum([
    "Propagation",
    "Plugs/Liners",
    "Potted",
    "Ready for Sale",
    "Looking Good",
    "Archived",
  ]),
  supplier: z.string().optional(),
  plantingDate: z.string().optional(), // ISO if provided; we'll default to now
  logRemainingAsLoss: z.boolean().optional().default(false),
});

export async function POST(
  req: Request,
  ctx: { params: { batchId: string } }
) {
  try {
    // const user = await getUser(); // optional auth
    const { batchId } = ctx.params;
    const raw = await req.json();
    const body = TransplantSchema.parse(raw);

    const result = await adminDb.runTransaction(async (tx) => {
      const srcRef = adminDb.collection("batches").doc(batchId);
      const srcSnap = await tx.get(srcRef);
      if (!srcSnap.exists) {
        throw new Error("Source batch not found");
      }
      const src = srcSnap.data() as any;

      const srcQty: number = Number(src.quantity ?? 0);
      if (body.quantity > srcQty) {
        throw new Error(
          `Transplant quantity (${body.quantity}) exceeds available quantity (${srcQty}).`
        );
      }

      // Create destination batch number and doc
      const dstRef = adminDb.collection("batches").doc();
      const batchNumber = await allocateBatchNumber(tx);

      const nowServer = FieldValue.serverTimestamp();
      const nowIso = new Date().toISOString();

      // Build destination doc (copy authoritative fields from source)
      const dstDoc = {
        id: dstRef.id,
        batchNumber,
        category: src.category,
        plantFamily: src.plantFamily,
        plantVariety: src.plantVariety,
        plantingDate: body.plantingDate ?? nowIso,
        initialQuantity: body.quantity,
        quantity: body.quantity,
        status: body.status,
        location: body.location,
        size: body.size,
        supplier: body.supplier ?? src.supplier ?? null,
        transplantedFrom: src.batchNumber ?? batchId,
        createdAt: nowServer,
        updatedAt: nowServer,
        // If you keep a document-level logHistory array (your UI shows this):
        logHistory: FieldValue.arrayUnion({
          id: `log_${Date.now()}_create_from_transplant`,
          type: "TRANSPLANT_FROM",
          note: `Created from transplant of ${body.quantity} units from batch ${
            src.batchNumber ?? batchId
          }.`,
          date: nowIso,
        }),
      };

      tx.set(dstRef, dstDoc);

      // Update source batch quantity (and possibly archive)
      const remaining = srcQty - body.quantity;
      const srcUpdates: Record<string, any> = {
        quantity: remaining,
        updatedAt: nowServer,
        logHistory: FieldValue.arrayUnion({
          id: `log_${Date.now()}_transplant_to`,
          type: "TRANSPLANT_TO",
          note: `Transplanted ${body.quantity} units to new batch ${batchNumber}.`,
          date: nowIso,
        }),
      };

      // Optional: log remaining as loss and archive original
      if (body.logRemainingAsLoss && remaining > 0) {
        srcUpdates.quantity = 0;
        srcUpdates.status = "Archived";
        srcUpdates.logHistory = FieldValue.arrayUnion(
          {
            id: `log_${Date.now()}_transplant_to`,
            type: "TRANSPLANT_TO",
            note: `Transplanted ${body.quantity} units to new batch ${batchNumber}.`,
            date: nowIso,
          },
          {
            id: `log_${Date.now()}_loss_auto`,
            type: "LOSS",
            note: `Logged remaining ${remaining} units as loss during transplant.`,
            date: nowIso,
          },
          {
            id: `log_${Date.now()}_archive_auto`,
            type: "ARCHIVE",
            note: "Batch quantity reached zero and was automatically archived.",
            date: nowIso,
          }
        );
      } else if (remaining === 0 && src.status !== "Archived") {
        // Auto-archive if zero remains
        srcUpdates.status = "Archived";
        srcUpdates.logHistory = FieldValue.arrayUnion(
          {
            id: `log_${Date.now()}_transplant_to`,
            type: "TRANSPLANT_TO",
            note: `Transplanted ${body.quantity} units to new batch ${batchNumber}.`,
            date: nowIso,
          },
          {
            id: `log_${Date.now()}_archive_auto`,
            type: "ARCHIVE",
            note: "Batch quantity reached zero and was automatically archived.",
            date: nowIso,
          }
        );
      }

      tx.update(srcRef, srcUpdates);

      // If you also maintain a logs subcollection, you can set() there too.
      // (Your UI currently reads logHistory from the doc; leaving this optional.)

      return { id: dstRef.id, batchNumber };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    const message = e?.message ?? "Unknown error";
    if (
      message.includes("exceeds available quantity") ||
      message.includes("not found")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { status, body } = mapError(e);
    return NextResponse.json(body, { status });
  }
}