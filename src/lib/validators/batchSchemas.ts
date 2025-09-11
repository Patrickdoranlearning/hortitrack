import { z } from "zod";
import { PRODUCTION_PHASE, PRODUCTION_STATUS } from "@/lib/enums";

const uuid = z.string().uuid("Invalid id");

export const PropagationStartSchema = z.object({
  plant_variety_id: uuid,
  size_id: uuid,
  location_id: uuid,
  supplier_id: uuid.optional().nullable(),
  planted_at: z.coerce.date().default(new Date()),
  initial_tray_qty: z.coerce.number().int().min(1),
  // preview-only field; server recomputes and sets quantity:
  total_quantity: z.coerce.number().int().min(1).optional(),
  note: z.string().max(500).optional(),
});

export type PropagationStartInput = z.infer<typeof PropagationStartSchema>;

export const BatchCheckInSchema = z.object({
  plant_variety_id: uuid,
  size_id: uuid,
  location_id: uuid,
  supplier_id: uuid.optional().nullable(),
  status: z.enum(PRODUCTION_STATUS),
  phase: z.enum(PRODUCTION_PHASE),
  check_in_date: z.coerce.date().default(new Date()),
  tray_qty: z.coerce.number().int().min(1),
  total_quantity: z.coerce.number().int().min(1).optional(),
  note: z.string().max(1000).optional(),
  passport_a: z.string().optional(), // family/genus/species text
  passport_b: z.string().optional(), // producer code
  passport_c: z.string().optional(), // supplier batch no.
  passport_d: z.string().optional(), // country code
});
export type BatchCheckInInput = z.infer<typeof BatchCheckInSchema>;
