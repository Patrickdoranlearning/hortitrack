import { z } from "zod";

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
});

export type BatchSummary = z.infer<typeof BatchSummarySchema>;
