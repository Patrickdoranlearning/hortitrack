
import { z } from "zod";

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const CountryCode = z.string().regex(/^[A-Z]{2}$/, "Use ISO 3166-1 alpha-2, e.g. IE, NL");

export const PassportOverrideSchema = z.object({
  operator_reg_no: z.string().min(2).max(32).optional(),
  origin_country: CountryCode.optional(),
  traceability_code: z.string().min(1).max(120).optional(),
});


export const PropagationInputSchema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  containers: z.number().int().min(1),
  planted_at: DateOnly.optional(),
  notes: z.string().max(1000).optional(),
});
export type PropagationInput = z.infer<typeof PropagationInputSchema>;

export const CheckInInputSchema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  phase: z.enum(["propagation", "plug", "potted"]),
  supplier_id: z.string().uuid(),
  containers: z.number().int().min(1),
  supplier_batch_number: z.string().min(1).max(120),
  incoming_date: DateOnly,
  quality_rating: z.number().int().min(1).max(6).optional(),
  pest_or_disease: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  photo_urls: z.array(z.string().url()).max(3).optional(),
  passport_override: PassportOverrideSchema.optional(),
});
export type CheckInInput = z.infer<typeof CheckInInputSchema>;

export const TransplantInputSchema = z.object({
  parent_batch_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  containers: z.number().int().min(1),
  planted_at: DateOnly.optional(),
  notes: z.string().max(1000).optional(),
  archive_parent_if_empty: z.boolean().optional(),
});
export type TransplantInput = z.infer<typeof TransplantInputSchema>;

export const MultiTransplantInputSchema = z.object({
  child: z.object({
    plant_variety_id: z.string().uuid(),
    size_id: z.string().uuid(),
    location_id: z.string().uuid(),
    packs: z.number().int().min(1),
    units_per_pack: z.number().int().min(1),
    planted_at: DateOnly.optional(),
    notes: z.string().max(1000).optional(),
  }),
  parents: z
    .array(
      z.object({
        parent_batch_id: z.string().uuid(),
        units: z.number().int().min(1),
        notes: z.string().max(500).optional(),
        archive_parent_if_empty: z.boolean().optional(),
      })
    )
    .min(1, "Add at least one source batch"),
});
export type MultiTransplantInput = z.infer<typeof MultiTransplantInputSchema>;
