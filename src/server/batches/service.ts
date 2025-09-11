import { getSupabaseForRequest } from "@/server/db/supabaseServer";
import { z } from "zod";
import {
  BatchSchema,
  CheckinFormSchema,
  PropagationFormSchema,
  PlantPassport,
  BatchEvent,
} from "@/lib/types"; // Assuming BatchEvent and PlantPassport are defined in types.ts
import { calcUnitsFromTrays, calcUnitsFromContainers } from "@/lib/quantity";
import { makeInternalPassport, makeSupplierPassport, isSupplierPassport } from "@/lib/passport";
import { generateNextBatchId } from "@/server/batches/nextId"; // Use Supabase-compatible nextId
import { getUserIdAndOrgId } from "@/server/auth/getUser";

// Helper to convert PlantPassport type to snake_case for Supabase insert
function passportToSupabase(passport: PlantPassport, orgId: string, batchId: string, userId: string | null) {
  return {
    batch_id: batchId,
    org_id: orgId,
    passport_type: passport.type,
    botanical_name: passport.botanicalName,
    operator_reg_no: passport.operatorRegNo,
    traceability_code: passport.traceabilityCode,
    origin_country: passport.originCountry,
    pz_codes: passport.protectedZone ? JSON.stringify(passport.protectedZone) : null,
    issuer_name: passport.issuerName,
    issue_date: passport.issueDate ? passport.issueDate.toISOString() : null,
    raw_label_text: passport.rawLabelText,
    raw_barcode_text: passport.rawBarcodeText,
    images: passport.images ? JSON.stringify(passport.images) : null,
    created_at: passport.createdAt.toISOString(),
    created_by_user_id: userId,
  };
}

// Helper to convert BatchEvent type to snake_case for Supabase insert
function eventToSupabase(event: Omit<BatchEvent, "id">, orgId: string, batchId: string, userId: string | null) {
  return {
    batch_id: batchId,
    org_id: orgId,
    type: event.type,
    at: event.at.toISOString(),
    by_user_id: userId,
    payload: event.payload ? JSON.stringify(event.payload) : null,
    created_at: new Date().toISOString(),
  };
}

export async function createPropagationBatch(args: {
  input: z.infer<typeof PropagationFormSchema>;
  userId?: string | null;
}) {
  const supabase = getSupabaseForRequest();
  const { userId, orgId } = await getUserIdAndOrgId();

  if (!userId || !orgId) {
    throw new Error("User must be authenticated and belong to an organization.");
  }

  const input = PropagationFormSchema.parse(args.input);

  const units = calcUnitsFromTrays(input.fullTrays, input.partialCells ?? 0, input.sizeMultiple);

  const { id: batchNumber } = await generateNextBatchId({ when: new Date(input.plantingDate) });
  const now = new Date();

  // Generate initial internal passport
  const initialPassport = makeInternalPassport({
    family: input.family ?? null,
    ourBatchNumber: batchNumber,
    userId: userId,
  });

  // Insert the new batch
  const { data: newBatchData, error: batchError } = await supabase
    .from("batches")
    .insert({
      org_id: orgId,
      batch_number: batchNumber,
      phase: "Propagation",
      plant_variety_id: input.varietyId ?? null, // Assuming varietyId is the actual FK
      size_id: input.sizeId, // Assuming sizeId is the actual FK
      initial_quantity: units,
      quantity: units,
      location_id: input.locationId,
      status: "Growing", // Initial status for propagation
      planted_at: input.plantingDate, // Use planted_at from input
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      // Additional fields if needed from Batch type
      // e.g., category: input.category, plant_family: input.family
    })
    .select("id, batch_number")
    .single();

  if (batchError) {
    console.error("Error creating propagation batch:", batchError);
    throw new Error(`Failed to create propagation batch: ${batchError.message}`);
  }

  const newBatchId = newBatchData.id;

  // Insert the passport record into batch_passports table
  const supabasePassport = passportToSupabase(initialPassport, orgId, newBatchId, userId);
  const { data: newPassportRecord, error: passportInsertError } = await supabase
    .from("batch_passports")
    .insert(supabasePassport)
    .select("id")
    .single();

  if (passportInsertError) {
    console.error("Error inserting initial passport:", passportInsertError);
    throw new Error(`Failed to record initial passport: ${passportInsertError.message}`);
  }

  // Update batch with reference to its current passport
  const { error: updateBatchPassportError } = await supabase
    .from("batches")
    .update({ current_passport_id: newPassportRecord.id })
    .eq("id", newBatchId);

  if (updateBatchPassportError) {
    console.error("Error updating batch with current passport ID:", updateBatchPassportError);
    throw new Error(`Failed to link passport to batch: ${updateBatchPassportError.message}`);
  }

  // Insert the event record into batch_events table
  const event: Omit<BatchEvent, "id"> = {
    type: "PROPAGATION_IN",
    at: now,
    by: userId,
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
  const supabaseEvent = eventToSupabase(event, orgId, newBatchId, userId);
  const { error: eventError } = await supabase.from("batch_events").insert(supabaseEvent);

  if (eventError) {
    console.error("Error creating propagation event:", eventError);
    throw new Error(`Failed to log propagation event: ${eventError.message}`);
  }

  // Return the newly created batch (you might want to fetch it fully to conform to BatchSchema.parse)
  const { data: finalBatch, error: fetchError } = await supabase
    .from("batches")
    .select("*, plant_varieties(name, family), plant_sizes(name, container_type), nursery_locations(name), suppliers(name)")
    .eq("id", newBatchId)
    .single();

  if (fetchError) {
    console.error("Error fetching final batch after creation:", fetchError);
    throw new Error(`Failed to retrieve new batch details: ${fetchError.message}`);
  }

  // Need to transform back to camelCase for the frontend if this function returns a Batch type
  // For now, let's return the raw data and let client-side handle it, or we can use the transform helper.
  return finalBatch; // This will still be in snake_case initially
}

export async function createCheckinBatch(args: {
  input: z.infer<typeof CheckinFormSchema>;
  userId?: string | null;
}) {
  const supabase = getSupabaseForRequest();
  const { userId, orgId } = await getUserIdAndOrgId();

  if (!userId || !orgId) {
    throw new Error("User must be authenticated and belong to an organization.");
  }

  const input = CheckinFormSchema.parse(args.input);
  const { id: batchNumber } = await generateNextBatchId({ when: new Date(input.incomingDate) });
  const now = new Date();

  const units = input.overrideTotal
    ? input.totalUnits
    : calcUnitsFromContainers(input.containers, input.sizeMultiple);

  const supplierPassport = makeSupplierPassport({
    family: input.family ?? null,
    producerCode: input.passportB,
    supplierBatchNo: input.passportC,
    countryCode: input.passportD,
    userId: userId,
  });

  // Insert the new batch
  const { data: newBatchData, error: batchError } = await supabase
    .from("batches")
    .insert({
      org_id: orgId,
      batch_number: batchNumber,
      phase: input.phase,
      plant_variety_id: input.varietyId ?? null,
      size_id: input.sizeId,
      initial_quantity: units,
      quantity: units,
      location_id: input.locationId,
      supplier_id: input.supplierId,
      status: "Growing", // Default status for checked-in plants
      planted_at: input.incomingDate, // Use incomingDate as planted_at for check-in
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      // photos: JSON.stringify(input.photos ?? []), // photos should probably go into a separate table or storage
    })
    .select("id, batch_number")
    .single();

  if (batchError) {
    console.error("Error creating check-in batch:", batchError);
    throw new Error(`Failed to create check-in batch: ${batchError.message}`);
  }

  const newBatchId = newBatchData.id;

  // Insert the passport record into batch_passports table
  const supabasePassport = passportToSupabase(supplierPassport, orgId, newBatchId, userId);
  const { data: newPassportRecord, error: passportInsertError } = await supabase
    .from("batch_passports")
    .insert(supabasePassport)
    .select("id")
    .single();

  if (passportInsertError) {
    console.error("Error inserting supplier passport:", passportInsertError);
    throw new Error(`Failed to record supplier passport: ${passportInsertError.message}`);
  }

  // Update batch with reference to its current passport
  const { error: updateBatchPassportError } = await supabase
    .from("batches")
    .update({ current_passport_id: newPassportRecord.id })
    .eq("id", newBatchId);

  if (updateBatchPassportError) {
    console.error("Error updating batch with current passport ID:", updateBatchPassportError);
    throw new Error(`Failed to link passport to batch: ${updateBatchPassportError.message}`);
  }

  // Insert the event record into batch_events table
  const event: Omit<BatchEvent, "id"> = {
    type: "CHECKIN",
    at: now,
    by: userId,
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
  const supabaseEvent = eventToSupabase(event, orgId, newBatchId, userId);
  const { error: eventError } = await supabase.from("batch_events").insert(supabaseEvent);

  if (eventError) {
    console.error("Error creating check-in event:", eventError);
    throw new Error(`Failed to log check-in event: ${eventError.message}`);
  }

  const { data: finalBatch, error: fetchError } = await supabase
    .from("batches")
    .select("*, plant_varieties(name, family), plant_sizes(name, container_type), nursery_locations(name), suppliers(name)")
    .eq("id", newBatchId)
    .single();

  if (fetchError) {
    console.error("Error fetching final batch after creation:", fetchError);
    throw new Error(`Failed to retrieve new batch details: ${fetchError.message}`);
  }
  return finalBatch;
}

export async function switchPassportToInternal(batchId: string, userId?: string | null) {
  const supabase = getSupabaseForRequest();
  const { orgId } = await getUserIdAndOrgId();

  if (!orgId) {
    throw new Error("User must belong to an organization to switch passport.");
  }

  // Fetch the batch and its current passport to determine if it's a supplier passport
  const { data: batch, error: batchFetchError } = await supabase
    .from("batches")
    .select("*, current_passport:batch_passports(*)") // Select current passport details
    .eq("id", batchId)
    .single();

  if (batchFetchError) throw batchFetchError;
  if (!batch) throw new Error("Batch not found");

  const currentPassport = batch.current_passport as PlantPassport; // Assuming structure is compatible

  if (!currentPassport || !isSupplierPassport(currentPassport)) return; // Already internal or no passport, no-op

  // Create new internal passport
  const newInternalPassport = makeInternalPassport({
    family: (batch as any).plant_family ?? null, // Access directly from batch, or from joined variety if available
    ourBatchNumber: batch.batch_number,
    userId: userId ?? null,
  });

  // Insert new internal passport into batch_passports table
  const supabaseNewPassport = passportToSupabase(newInternalPassport, orgId, batchId, userId);
  const { data: insertedPassport, error: insertPassportError } = await supabase
    .from("batch_passports")
    .insert(supabaseNewPassport)
    .select("id")
    .single();

  if (insertPassportError) {
    console.error("Error inserting new internal passport:", insertPassportError);
    throw new Error(`Failed to create internal passport: ${insertPassportError.message}`);
  }

  // Update the batch to point to the new current_passport_id
  const { error: updateBatchError } = await supabase
    .from("batches")
    .update({ current_passport_id: insertedPassport.id })
    .eq("id", batchId);

  if (updateBatchError) {
    console.error("Error updating batch with new internal passport ID:", updateBatchError);
    throw new Error(`Failed to update batch's current passport: ${updateBatchError.message}`);
  }

  // Log the event
  const event: Omit<BatchEvent, "id"> = {
    type: "TRANSPLANT",
    at: new Date(),
    by: userId ?? null,
    payload: { reason: "Transplant or lifecycle", from: currentPassport.type, to: "Internal" },
  };
  const supabaseEvent = eventToSupabase(event, orgId, batchId, userId);
  const { error: eventError } = await supabase.from("batch_events").insert(supabaseEvent);

  if (eventError) {
    console.error("Error logging passport switch event:", eventError);
    throw new Error(`Failed to log passport switch event: ${eventError.message}`);
  }
}
