
import { z } from "zod";

// --- Dictionaries ---
export const SupplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  contact: z.string().optional(),
});
export type Supplier = z.infer<typeof SupplierSchema>;

export const PlantSizeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1), // e.g., "9cm", "10.5cm"
  liters: z.number().optional(),
});
export type PlantSize = z.infer<typeof PlantSizeSchema>;

export const NurseryLocationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1), // e.g., "Tunnel A-12"
  capacity: z.number().int().nonnegative().optional(),
});
export type NurseryLocation = z.infer<typeof NurseryLocationSchema>;

export const VarietySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  family: z.string().min(1),
  category: z.string().default("Perennial"),
});
export type Variety = z.infer<typeof VarietySchema>;

// --- Logs ---
export const LogEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string().or(z.date()).transform((d) => (d instanceof Date ? d.toISOString() : d)),
  type: z.string().min(1),
  note: z.string().optional(),
  qty: z.number().optional(),
  reason: z.string().optional(),
  newLocation: z.string().optional(),
  newLocationId: z.string().optional(),
  fromBatch: z.string().optional(),
  toBatch: z.string().optional(),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

// --- Batches ---
export const BatchStatus = z.enum([
  "Propagation",
  "Plug",
  "Growing",
  "Ready",
  "Sold",
  "Archived",
]);
export type BatchStatus = z.infer<typeof BatchStatus>;

export const BatchSchema = z.object({
  id: z.string().optional(),
  batchNumber: z.string().min(3),
  category: z.string().min(1),
  plantFamily: z.string().min(1),
  plantVariety: z.string().min(1),
  plantingDate: z.string(), // ISO
  initialQuantity: z.number().int().nonnegative(),
  quantity: z.number().int().nonnegative(),
  status: BatchStatus,
  location: z.string().optional(),
  locationId: z.string().optional(),
  size: z.string().optional(),
  supplierId: z.string().optional(),
  flagged: z.boolean().default(false),
  flaggedAt: z.string().optional(), // ISO
  flaggedBy: z.string().optional(),
  notes: z.string().optional(),
  logs: z.array(LogEntrySchema).optional(),
});
export type Batch = z.infer<typeof BatchSchema>;

// --- Production Protocol (AI output) ---
export const ProductionProtocolStepSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  day: z.number().int().nonnegative().optional(),
  at: z.string().optional(),
  durationDays: z.number().int().nonnegative().optional(),
  params: z.record(z.any()).optional(),
});

export const ProductionTargetsSchema = z.object({
  tempC: z
    .object({
      day: z.number().nullable().optional(),
      night: z.number().nullable().optional(),
    })
    .optional(),
  humidityPct: z.number().nullable().optional(),
  lightHours: z.number().nullable().optional(),
  ec: z.number().nullable().optional(),
  ph: z.number().nullable().optional(),
  spacing: z.union([z.number(), z.string()]).nullable().optional(),
});

const ProductionProtocolRouteNodeSchema = z.object({
  id: z.string(),
  batchNumber: z.union([z.string(), z.number()]).nullable().optional(),
  plantVariety: z.string().nullable().optional(),
  sowDate: z.string().nullable().optional(),
  plantingDate: z.string().nullable().optional(),
  producedAt: z.string().nullable().optional(),
  potSize: z.union([z.string(), z.number()]).nullable().optional(),
  supplierName: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
});

export const ProductionProtocolRouteSchema = z.object({
  ancestry: z
    .array(
      z.object({
        level: z.number().int(),
        node: ProductionProtocolRouteNodeSchema,
        via: z
          .object({
            action: z.string().optional(),
            at: z.string().nullable().optional(),
            week: z.string().nullable().optional(),
            notes: z.string().nullable().optional(),
          })
          .nullable()
          .optional(),
      })
    )
    .optional()
    .default([]),
  timeline: z
    .array(
      z.object({
        at: z.string().nullable().optional(),
        week: z.string().nullable().optional(),
        action: z.string(),
        batchId: z.string(),
        note: z.string().nullable().optional(),
      })
    )
    .optional()
    .default([]),
  summary: z
    .object({
      transplantWeek: z.string().nullable().optional(),
      previousProducedWeek: z.string().nullable().optional(),
      originBatchId: z.string().nullable().optional(),
      hops: z.number().int().nullable().optional(),
    })
    .optional(),
});

export const ProductionProtocolOutputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  version: z.number().int().optional(),
  status: z.enum(["draft", "published"]).optional(),
  createdAt: z.any().optional(),
  createdFromBatchId: z.string(),

  plantFamily: z.string().nullable().optional(),
  plantVariety: z.string().nullable().optional(),
  season: z.string().nullable().optional(),

  potSize: z.union([z.string(), z.number()]).nullable().optional(),
  media: z.string().nullable().optional(),
  containerType: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),

  targets: ProductionTargetsSchema.optional(),
  steps: z.array(ProductionProtocolStepSchema).optional().default([]),

  sourceSnapshot: z.record(z.any()).optional(),
  route: ProductionProtocolRouteSchema.optional(),
});
