/**
 * Consolidated Batch Domain Schemas
 * 
 * This is the SINGLE SOURCE OF TRUTH for all batch-related validation schemas.
 * Import from here in Forms, Server Actions, and API routes.
 */

import { z } from "zod";
import { PRODUCTION_STATUS } from "@/lib/enums";

// ============================================================================
// Shared Primitives
// ============================================================================

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format");
const CountryCode = z.string().regex(/^[A-Z]{2}$/, "Use ISO 3166-1 alpha-2, e.g. IE, NL");

export const PhaseSchema = z.enum(["propagation", "plug", "potted", "plug_linear"]);
export type Phase = z.infer<typeof PhaseSchema>;

export const ProductionStatusSchema = z.enum(PRODUCTION_STATUS);
export type ProductionStatus = z.infer<typeof ProductionStatusSchema>;

// ============================================================================
// Passport Schemas
// ============================================================================

export const PassportOverrideSchema = z.object({
  operator_reg_no: z.string().min(2).max(32).optional(),
  origin_country: CountryCode.optional(),
  traceability_code: z.string().min(1).max(120).optional(),
});
export type PassportOverride = z.infer<typeof PassportOverrideSchema>;

export const PlantPassportSchema = z.object({
  source: z.enum(["Supplier", "Internal"]),
  aFamily: z.string().nullable(),
  bProducerCode: z.string().nullable(),
  cBatchNumber: z.string(),
  dCountryCode: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
});
export type PlantPassport = z.infer<typeof PlantPassportSchema>;

// ============================================================================
// Propagation Schemas
// ============================================================================

/**
 * Schema for creating a new propagation batch (seeds/cuttings started in-house)
 */
export const PropagationInputSchema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  containers: z.number().int().min(1, "At least 1 container required"),
  planted_at: DateOnly.optional(),
  notes: z.string().max(1000).optional(),
});
export type PropagationInput = z.infer<typeof PropagationInputSchema>;

/**
 * Form-level propagation schema (camelCase for React Hook Form)
 * Maps to PropagationInputSchema via transformation
 */
export const PropagationFormSchema = z.object({
  varietyId: z.string().optional(),
  variety: z.string().min(1, "Variety is required"),
  family: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  sizeId: z.string().min(1, "Size is required"),
  sizeMultiple: z.number().int().positive("Must be > 0"),
  fullTrays: z.number().int().min(0, "Must be >= 0"),
  partialCells: z.number().int().min(0).default(0),
  locationId: z.string().min(1, "Location is required"),
  plantingDate: z.string().min(1, "Planting date is required"),
});
export type PropagationFormValues = z.infer<typeof PropagationFormSchema>;

// ============================================================================
// Check-In Schemas (Incoming Stock from Suppliers)
// ============================================================================

/**
 * Schema for checking in batches from external suppliers
 */
export const CheckInInputSchema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  phase: PhaseSchema,
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

/**
 * Form-level check-in schema (camelCase for React Hook Form)
 */
export const CheckInFormSchema = z.object({
  varietyId: z.string().optional(),
  variety: z.string().min(1),
  family: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  sizeId: z.string().min(1),
  sizeMultiple: z.number().int().positive(),
  phase: PhaseSchema,
  containers: z.number().int().min(0),
  totalUnits: z.number().int().min(0),
  overrideTotal: z.boolean().default(false),
  locationId: z.string().min(1),
  incomingDate: z.string(),
  supplierId: z.string().min(1),
  photos: z.array(z.string().url()).max(3).optional(),
  // Supplier passport fields
  passportA: z.string().min(1),
  passportB: z.string().min(1),
  passportC: z.string().min(1), // supplier batch number
  passportD: z.string().min(1),
  // Quality fields
  pestsPresent: z.boolean().optional(),
  qualityNotes: z.string().optional(),
  qualityStars: z.number().int().min(1).max(6).optional(),
});
export type CheckInFormValues = z.infer<typeof CheckInFormSchema>;

// ============================================================================
// Transplant Schemas
// ============================================================================

/**
 * Schema for transplanting from one batch to create a new batch
 */
export const TransplantInputSchema = z.object({
  parent_batch_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  containers: z.number().int().min(1, "At least 1 container required"),
  planted_at: DateOnly.optional(),
  notes: z.string().max(1000).optional(),
  archive_parent_if_empty: z.boolean().optional().default(true),
});
export type TransplantInput = z.infer<typeof TransplantInputSchema>;

/**
 * Multi-parent transplant (combining multiple source batches into one)
 */
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

// ============================================================================
// Batch Event Schemas
// ============================================================================

export const BatchEventTypeSchema = z.enum([
  "CHECKIN",
  "PROPAGATION_IN",
  "TRANSPLANT_IN",
  "TRANSPLANT_OUT",
  "MOVE",
  "COUNT",
  "LOSS",
  "ARCHIVE",
  "NOTE",
]);
export type BatchEventType = z.infer<typeof BatchEventTypeSchema>;

export const BatchEventSchema = z.object({
  id: z.string(),
  type: BatchEventTypeSchema,
  at: z.string(),
  by: z.string().nullable(),
  payload: z.record(z.unknown()),
});
export type BatchEvent = z.infer<typeof BatchEventSchema>;

// ============================================================================
// Quantity Schemas
// ============================================================================

export const QuantitySnapshotSchema = z.object({
  sizeId: z.string().optional(),
  sizeMultiple: z.number().int().positive(),
  containers: z.number().int().min(0),
  partialCells: z.number().int().min(0).optional(),
  units: z.number().int().min(0),
  overridden: z.boolean().optional(),
});
export type QuantitySnapshot = z.infer<typeof QuantitySnapshotSchema>;

// ============================================================================
// Full Batch Schema (for API responses)
// ============================================================================

export const BatchSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  phase: PhaseSchema.optional(),
  varietyId: z.string().optional(),
  variety: z.string().optional(),
  family: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  sizeId: z.string().optional(),
  sizeMultipleAtStart: z.number().int().positive(),
  containersStart: z.number().int().min(0),
  unitsStart: z.number().int().min(0),
  unitsCurrent: z.number().int().min(0),
  quantityOverridden: z.boolean().optional(),
  locationId: z.string(),
  supplierId: z.string().nullable().optional(),
  createdAt: z.string(),
  createdBy: z.string().nullable().optional(),
  currentPassport: PlantPassportSchema.optional(),
});
export type Batch = z.infer<typeof BatchSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert form values to API input format
 */
export function propagationFormToInput(form: PropagationFormValues): PropagationInput {
  const totalUnits = form.fullTrays * form.sizeMultiple + form.partialCells;
  const containers = Math.ceil(totalUnits / form.sizeMultiple);
  
  return {
    plant_variety_id: form.varietyId!,
    size_id: form.sizeId,
    location_id: form.locationId,
    containers,
    planted_at: form.plantingDate,
  };
}

