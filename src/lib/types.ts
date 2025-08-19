
import { z } from "zod";

// --- Dictionaries ---
export const SupplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Supplier name is required'),
  address: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  producerCode: z.string().optional(),
  operatorRegNo: z.string().optional(),
  contact: z.string().optional(),
  active: z.boolean().default(true).optional(),
});
export type Supplier = z.infer<typeof SupplierSchema>;

export const PlantSizeSchema = z.object({
  id: z.string().optional(),
  size: z.string().min(1, "Size name is required"),
  type: z.enum(["Pot", "Tray", "Bareroot"]),
  area: z.number().optional(),
  shelfQuantity: z.number().optional(),
  multiple: z.number().optional(),
});
export type PlantSize = z.infer<typeof PlantSizeSchema>;

export const NurseryLocationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Location name is required"),
  nursery: z.string().optional(),
  type: z.string().optional(),
  area: z.number().optional(),
  isCovered: z.boolean().optional(),
  capacity: z.number().int().nonnegative().optional(),
});
export type NurseryLocation = z.infer<typeof NurseryLocationSchema>;

export const VarietySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  family: z.string().min(1),
  category: z.string().default("Perennial"),
  grouping: z.string().optional(),
  commonName: z.string().optional(),
  rating: z.string().optional(),
  salesPeriod: z.string().optional(),
  floweringPeriod: z.string().optional(),
  flowerColour: z.string().optional(),
  evergreen: z.string().optional(),
});
export type Variety = z.infer<typeof VarietySchema>;

// --- Plant Passport ---
export const PlantPassportSchema = z.object({
    id: z.string(),
    type: z.enum(["received", "issued"]),
    botanicalName: z.string(),           // A
    operatorRegNo: z.string(),           // B e.g. IE-xxxxxxx
    traceabilityCode: z.string(),        // C (lot/trace code)
    originCountry: z.string(),           // D (ISO alpha-2)
    protectedZone: z.object({ codes: z.array(z.string()) }).optional(), // when PZ applies
    issuerName: z.string().optional(),
    issueDate: z.date().optional(),
    rawLabelText: z.string().optional(),
    rawBarcodeText: z.string().optional(),
    images: z.array(z.object({ url: z.string(), name: z.string().optional() })).optional(),
    createdAt: z.date(),
    createdBy: z.string(),
});
export type PlantPassport = z.infer<typeof PlantPassportSchema>;


// --- Logs ---
export const LogEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string().or(z.date()).transform((d) => (d instanceof Date ? d.toISOString() : d)),
  type: z.string().min(1),
  at: z.string().or(z.date()).optional().transform((d) => (d instanceof Date ? d.toISOString() : d)),
  note: z.string().optional(),
  qty: z.number().optional(),
  reason: z.string().optional(),
  newLocation: z.string().optional(),
  newLocationId: z.string().optional(),
  fromBatch: z.string().optional(),
  toBatch: z.string().optional(),
  action: z.string().optional(),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

// --- Batches ---
export const BatchStatus = z.enum([
  "Propagation",
  "Plugs/Liners",
  "Potted",
  "Ready for Sale",
  "Looking Good",
  "Archived",
]);
export type BatchStatus = z.infer<typeof BatchStatus>;

export const BatchSchema = z.object({
  id: z.string().optional(),
  batchNumber: z.string(),
  category: z.string().min(1),
  plantFamily: z.string().min(1),
  plantVariety: z.string().min(1),
  plantingDate: z.string(), // ISO
  initialQuantity: z.number().int().nonnegative(),
  quantity: z.number().int().nonnegative(),
  status: BatchStatus,
  location: z.string().optional(),
  locationId: z.string().optional(),
  size: z.string(),
  supplier: z.string().optional(),
  supplierId: z.string().optional(),
  supplierRef: z.string().optional(),
  deliveryRef: z.string().optional(),
  notes: z.string().optional(),
  logHistory: z.array(LogEntrySchema).default([]),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
  transplantedFrom: z.string().optional(),
  growerPhotoUrl: z.string().url().optional(),
  salesPhotoUrl: z.string().url().optional(),
  isTopPerformer: z.boolean().optional(),
  
  // New fields for check-in and passport
  sourceType: z.enum(["Propagation", "Purchase"]).default("Propagation"),
  
  qcStatus: z.enum(["Pending", "Accepted", "Rejected", "Quarantined"]).default("Pending"),
  qcNotes: z.string().optional(),

  // Flag object for issue tracking
  flag: z.object({
    active: z.boolean().default(false),
    reason: z.string().optional(),
    remedy: z.string().optional(),
    severity: z.enum(["low", "medium", "high"]).optional(),
    flaggedAt: z.string().optional(),
    flaggedBy: z.string().optional(),
  }).optional(),
  
  // --- Plant Passport stored on Batch ---
  passportType: z.enum(["received", "issued"]).optional(),
  passportBotanical: z.string().optional(),   // A
  passportOperator: z.string().optional(),   // B (operator reg no)
  passportTraceCode: z.string().optional(),  // C
  passportOrigin: z.string().optional(),     // D (ISO alpha-2)
  passportPZ: z.any().optional(),            // { codes: string[] }
  passportRawText: z.string().optional(),
  passportRawBarcode: z.string().optional(),
  passportImages: z.any().optional(),        // StoredFile[]
  passportIssueDate: z.any().optional(),
  passportIssuerName: z.string().optional(),
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
  protocolTitle: z.string().optional(),
  summary: z.string().optional(),
  timeline: z.array(z.object({
    day: z.number(),
    action: z.string(),
    details: z.string(),
    date: z.string().optional(),
  })).optional(),
  recommendations: z.array(z.string()).optional(),
  targets: ProductionTargetsSchema.optional(),
  steps: z.array(ProductionProtocolStepSchema).default([]),
  route: ProductionProtocolRouteSchema.optional(),
});
export type ProductionProtocolOutput = z.infer<typeof ProductionProtocolOutputSchema>;
