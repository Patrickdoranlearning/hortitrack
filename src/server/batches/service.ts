import { adminDb } from "@/server/db/admin";
import { z } from "zod";
import {
  BatchSchema,
  CheckinFormSchema,
  PropagationFormSchema,
  PlantPassport,
  BatchEvent,
} from "@/types/batch";
import { calcUnitsFromTrays, calcUnitsFromContainers } from "@/lib/quantity";
import { makeInternalPassport, makeSupplierPassport, isSupplierPassport } from "@/lib/passport";

async function nextSequence(prefix: "1" | "2") {
  const year = new Date().getFullYear();
  const key = `batch_seq_${prefix}_${year}`;
  const ref = adminDb.collection("counters").doc(key);
  const res = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const curr = (snap.exists ? (snap.data() as any).value : 0) as number;
    const next = curr + 1;
    tx.set(ref, { value: next }, { merge: true });
    return next;
  });
  const seq = String(res).padStart(5, "0");
  return `${prefix}-${year}-${seq}`;
}

export async function createPropagationBatch(args: {
  input: z.infer<typeof PropagationFormSchema>;
  userId?: string | null;
}) {
  const input = PropagationFormSchema.parse(args.input);

  const units = calcUnitsFromTrays(input.fullTrays, input.partialCells ?? 0, input.sizeMultiple);

  const batchNumber = await nextSequence("1");
  const nowISO = new Date().toISOString();

  const batchRef = adminDb.collection("batches").doc();
  const passport = makeInternalPassport({
    family: input.family ?? null,
    ourBatchNumber: batchNumber,
    userId: args.userId ?? null,
  });
  const batchDoc = {
    id: batchRef.id,
    batchNumber,
    phase: "Propagation",
    varietyId: input.varietyId ?? null,
    variety: input.variety,
    family: input.family ?? null,
    category: input.category ?? null,
    sizeId: input.sizeId,
    sizeMultipleAtStart: input.sizeMultiple,
    containersStart: input.fullTrays, // trays
    unitsStart: units,
    unitsCurrent: units,
    quantityOverridden: false,
    locationId: input.locationId,
    supplierId: null,
    createdAt: nowISO,
    createdBy: args.userId ?? null,
    plantingDate: input.plantingDate,
    currentPassport: passport,
  };

  const eventRef = batchRef.collection("events").doc();
  const event: Omit<BatchEvent, "id"> = {
    type: "PROPAGATION_IN",
    at: nowISO,
    by: args.userId ?? null,
    payload: {
      sizeId: input.sizeId,
      sizeMultiple: input.sizeMultiple,
      fullTrays: input.fullTrays,
      partialCells: input.partialCells ?? 0,
      units,
      locationId: input.locationId,
      plantingDate: input.plantingDate,
    },
  };

  await adminDb.runTransaction(async (tx) => {
    tx.set(batchRef, batchDoc);
    tx.set(eventRef, { id: eventRef.id, ...event });
    // also snapshot passport
    const passRef = batchRef.collection("passports").doc();
    tx.set(passRef, { id: passRef.id, ...passport });
  });

  const parsed = BatchSchema.parse(batchDoc);
  return parsed;
}

export async function createCheckinBatch(args: {
  input: z.infer<typeof CheckinFormSchema>;
  userId?: string | null;
}) {
  const input = CheckinFormSchema.parse(args.input);
  const batchNumber = await nextSequence("2");
  const nowISO = new Date().toISOString();

  const units = input.overrideTotal
    ? input.totalUnits
    : calcUnitsFromContainers(input.containers, input.sizeMultiple);

  const passport = makeSupplierPassport({
    family: input.family ?? null,
    producerCode: input.passportB,
    supplierBatchNo: input.passportC,
    countryCode: input.passportD,
    userId: args.userId ?? null,
  });

  const batchRef = adminDb.collection("batches").doc();
  const batchDoc = {
    id: batchRef.id,
    batchNumber,
    phase: input.phase,
    varietyId: input.varietyId ?? null,
    variety: input.variety,
    family: input.family ?? null,
    category: input.category ?? null,
    sizeId: input.sizeId,
    sizeMultipleAtStart: input.sizeMultiple,
    containersStart: input.containers,
    unitsStart: units,
    unitsCurrent: units,
    quantityOverridden: input.overrideTotal,
    locationId: input.locationId,
    supplierId: input.supplierId,
    createdAt: nowISO,
    createdBy: args.userId ?? null,
    incomingDate: input.incomingDate,
    photos: input.photos ?? [],
    currentPassport: passport,
  };

  const eventRef = batchRef.collection("events").doc();
  const event: Omit<BatchEvent, "id"> = {
    type: "CHECKIN",
    at: nowISO,
    by: args.userId ?? null,
    payload: {
      sizeId: input.sizeId,
      sizeMultiple: input.sizeMultiple,
      containers: input.containers,
      units,
      overrideTotal: input.overrideTotal,
      locationId: input.locationId,
      incomingDate: input.incomingDate,
      supplierId: input.supplierId,
      photos: input.photos ?? [],
      supplierPassport: {
        a: input.passportA,
        b: input.passportB,
        c: input.passportC,
        d: input.passportD,
      },
      quality: {
        pestsPresent: input.pestsPresent ?? false,
        qualityNotes: input.qualityNotes ?? "",
        qualityStars: input.qualityStars ?? null,
      },
    },
  };

  await adminDb.runTransaction(async (tx) => {
    tx.set(batchRef, batchDoc);
    tx.set(eventRef, { id: eventRef.id, ...event });
    const passRef = batchRef.collection("passports").doc();
    tx.set(passRef, { id: passRef.id, ...passport });
  });

  return batchDoc;
}

export async function switchPassportToInternal(batchId: string, userId?: string | null) {
  const batchRef = adminDb.collection("batches").doc(batchId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(batchRef);
    if (!snap.exists) throw new Error("Batch not found");
    const batch = snap.data() as any;
    const current: PlantPassport = batch.currentPassport;
    if (!isSupplierPassport(current)) return; // already internal, no-op

    const newPassport = makeInternalPassport({
      family: batch.family ?? null,
      ourBatchNumber: batch.batchNumber,
      userId: userId ?? null,
    });

    tx.update(batchRef, { currentPassport: newPassport });

    const passRef = batchRef.collection("passports").doc();
    tx.set(passRef, { id: passRef.id, ...newPassport });

    const eventRef = batchRef.collection("events").doc();
    tx.set(eventRef, {
      id: eventRef.id,
      type: "TRANSPLANT",
      at: new Date().toISOString(),
      by: userId ?? null,
      payload: { reason: "Transplant or lifecycle", from: current.source, to: "Internal" },
    });
  });
}
