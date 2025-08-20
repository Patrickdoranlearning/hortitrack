import { adminDb } from "@/server/db/admin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BatchSchema, BatchStatus } from "@/lib/types";
import { generateNextBatchId, type BatchPhase } from "@/server/batches/nextId";
import { dualWriteBatchCreate } from "@/server/dualwrite";
import { declassify } from "@/server/utils/declassify";

const CreateBatch = BatchSchema.omit({
  id: true,
  logHistory: true,
  createdAt: true,
  updatedAt: true,
  batchNumber: true,
  quantity: true, // Initial quantity will be set as current quantity
}).extend({
  initialQuantity: z.number().int().nonnegative().min(1, "Initial quantity must be at least 1"),
});

export async function POST(req: Request) {
  const maybe = await req.json();
  const stageMap: Record<string, BatchPhase> = {
    'Propagation': 'PROPAGATION',
    'Plugs/Liners': 'PLUGS',
    'Potted': 'POTTING',
    'Ready for Sale': 'POTTING',
    'Looking Good': 'POTTING'
  };

  // Determine the phase for batch ID generation based on the incoming status
  const phase = stageMap[maybe.status as BatchStatus] || 'POTTING';

  let batchNumber: string;
  try {
    const { id } = await generateNextBatchId(phase, new Date(maybe.plantingDate));
    batchNumber = id;
  } catch (error: any) {
    console.error("Error generating next batch ID:", error);
    return NextResponse.json({ ok: false, error: "Failed to generate batch number: " + error.message }, { status: 500 });
  }

  const data = CreateBatch.parse({ ...maybe, batchNumber });

  const ref = adminDb.collection("batches").doc();
  await ref.set({
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const snap = await ref.get();
  const out = { id: ref.id, ...declassify(snap.data()) } as any;
  // non-blocking dual-write
  dualWriteBatchCreate({
    id: out.id,
    batchNumber: out.batchNumber,
    category: out.category,
    plantFamily: out.plantFamily,
    plantVariety: out.plantVariety,
    plantingDate: out.plantingDate,
    initialQuantity: out.initialQuantity,
    quantity: out.quantity,
    status: out.status,
    location: out.location ?? null,
    locationId: out.locationId ?? null,
    size: out.size ?? null,
    supplierId: out.supplierId ?? null,
    notes: out.notes ?? null,
  }).catch(() => {});
  return NextResponse.json(out, { status: 201 });
}
