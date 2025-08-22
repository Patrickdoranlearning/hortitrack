import { z } from "zod";

// ⬇️ Add this schema
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

// ⬇️ Extend BatchSummarySchema to include plantPassport (optional)
export const BatchSummarySchema = z.object({
  batchNumber: z.string(),
  variety: z.string().optional(),
  size: z.string().optional(),
  productionWeek: z.string().nullable().optional(),
  status: z.string().optional(),
  plantPassport: PlantPassportSchema.optional(),   // <— NEW
});

export type PlantPassport = z.infer<typeof PlantPassportSchema>;
export type BatchSummary = z.infer<typeof BatchSummarySchema>;
