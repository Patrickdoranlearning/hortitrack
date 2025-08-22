
import { z } from "zod";

// NEW: supplier shape (all optional)
export const SupplierSchema = z.object({
  name: z.string().optional(),
  producerCode: z.string().optional(),   // B
  countryCode: z.string().optional(),    // D
});

export const PlantPassportSchema = z.object({
  A_botanicalName: z.string().optional(),          // Botanical name (variety/species)
  B_regNumber: z.string().optional(),              // e.g. "IE-1234-AB"
  C_traceabilityCode: z.string().optional(),       // usually batchNumber
  D_countryOfOrigin: z.string().optional(),        // e.g. "IE"
});

export const AncestryNodeSchema = z.object({
  batchNumber: z.string(),
  variety: z.string().nullable().optional(),
  family: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  productionWeek: z.string().nullable().optional(),
  status: z.string(),                  // keep flexible; backend controls set
  locked: z.boolean().optional().default(false), // optional: permission guard
});

export type AncestryNode = z.infer<typeof AncestryNodeSchema>;

// API returns ordered nodes: [current, -1, -2, ...]
export const AncestryResponseSchema = z.array(AncestryNodeSchema);

export const BatchSummarySchema = z.object({
  batchNumber: z.string(),
  variety: z.string().optional(),
  size: z.string().optional(),
  productionWeek: z.string().nullable().optional(),
  status: z.string().optional(),
  // NEW:
  family: z.string().optional(),         // A
  supplier: SupplierSchema.optional(),   // B, D (and name if you need)
});


export type PlantPassport = z.infer<typeof PlantPassportSchema>;
export type Supplier = z.infer<typeof SupplierSchema>;
export type BatchSummary = z.infer<typeof BatchSummarySchema>;
