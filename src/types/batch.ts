
import { z } from "zod";

// NEW: supplier shape (all optional)
export const SupplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  producerCode: z.string().nullable().optional(),   // B
  countryCode: z.string().nullable().optional(),    // D
});


// ⬇️ Add this schema
export const PlantPassportSchema = z.object({
  aFamily: z.string().nullable().optional(),        // A
  bProducerCode: z.string().nullable().optional(),  // B
  cBatchNumber: z.string(),                          // C
  dCountryCode: z.string().nullable().optional(),   // D
});

// ⬇️ Extend BatchSummarySchema to include plantPassport (optional)
export const BatchSummarySchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  variety: z.string().optional(),
  size: z.string().nullable().optional(),
  productionWeek: z.string().nullable().optional(),
  status: z.string().optional(),
  family: z.string().nullable().optional(),         // A
  supplier: SupplierSchema.nullable().optional(),   // B, D (and name if you need)
});

export type PlantPassport = z.infer<typeof PlantPassportSchema>;
export type Supplier = z.infer<typeof SupplierSchema>;
export type BatchSummary = z.infer<typeof BatchSummarySchema>;


export const AncestryNodeSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  variety: z.string().optional(),
  size: z.string().optional(),
  isCurrent: z.boolean().optional(),
});
export type AncestryNode = z.infer<typeof AncestryNodeSchema>;

export const AncestryResponseSchema = z.array(AncestryNodeSchema);
