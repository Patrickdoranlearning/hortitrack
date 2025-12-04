import { z } from "zod";

export const PassportSourceSchema = z.enum(["Supplier", "Internal"]);
export type PassportSource = z.infer<typeof PassportSourceSchema>;

export const PlantPassportSchema = z.object({
  source: PassportSourceSchema,
  aFamily: z.string().nullable(),
  bProducerCode: z.string().nullable(),
  cBatchNumber: z.string(), // supplier or our batch, depending on source
  dCountryCode: z.string().nullable(),
  createdAt: z.string(), // ISO
  createdBy: z.string().nullable(),
});
export type PlantPassport = z.infer<typeof PlantPassportSchema>;

export const QuantitySnapshotSchema = z.object({
  sizeId: z.string().optional(),
  sizeMultiple: z.number().int().positive(),
  containers: z.number().int().min(0),
  partialCells: z.number().int().min(0).optional(),
  units: z.number().int().min(0),
  overridden: z.boolean().optional(),
});
export type QuantitySnapshot = z.infer<typeof QuantitySnapshotSchema>;

export const PhaseSchema = z.string().min(1);
export type Phase = z.infer<typeof PhaseSchema>;

export const ProductionStatusSchema = z.string().min(1);
export type ProductionStatus = z.infer<typeof ProductionStatusSchema>;

export const BatchSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  phase: PhaseSchema,
  status: ProductionStatusSchema.optional(),
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
  currentPassport: PlantPassportSchema,
  parentBatchId: z.string().nullable().optional(),
});
export type Batch = z.infer<typeof BatchSchema>;

// Events
export const BatchEventSchema = z.object({
  id: z.string(),
  type: z.enum(["CHECKIN", "PROPAGATION_IN", "TRANSPLANT"]),
  at: z.string(), // ISO
  by: z.string().nullable(),
  payload: z.record(z.any()),
});
export type BatchEvent = z.infer<typeof BatchEventSchema>;

// Form Schemas
export const PropagationFormSchema = z.object({
  varietyId: z.string().optional(),
  variety: z.string().min(1),
  family: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  sizeId: z.string().min(1),
  sizeMultiple: z.number().int().positive(),
  fullTrays: z.number().int().min(0),
  partialCells: z.number().int().min(0).default(0),
  locationId: z.string().min(1),
  plantingDate: z.string(), // ISO
});
export type PropagationFormInput = z.infer<typeof PropagationFormSchema>;

export const CheckinFormSchema = z.object({
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
  incomingDate: z.string(), // ISO
  supplierId: z.string().min(1),
  photos: z.array(z.string().url()).max(3).optional(), // storage URLs
  // Supplier passport
  passportA: z.string().min(1),
  passportB: z.string().min(1),
  passportC: z.string().min(1), // supplier batch number
  passportD: z.string().min(1),
  // Quality
  pestsPresent: z.boolean().optional(),
  qualityNotes: z.string().optional(),
  qualityStars: z.number().int().min(1).max(6).optional(),
});
export type CheckinFormInput = z.infer<typeof CheckinFormSchema>;