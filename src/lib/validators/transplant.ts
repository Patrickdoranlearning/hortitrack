// src/lib/validators/transplant.ts
import { z } from "zod";

export const TransplantRequestSchema = z.object({
  parentBatchId: z.string().uuid("Invalid parent batch id"),
  // optional manual batch number; if omitted, server autogenerates
  newBatchNumber: z.string().trim().optional(),
  newSizeId: z.string().uuid(),
  newLocationId: z.string().uuid(),
  // integer containers only (full trays/pots), >=1
  containers: z.number().int().positive(),
  // mark the rest of the parent as dumped & archive parent
  dumpAndArchiveRemainder: z.boolean().default(false),
  // optional plant passport overrides (A-D)
  passportOverrideA: z.string().trim().optional(),
  passportOverrideB: z.string().trim().optional(),
  passportOverrideC: z.string().trim().optional(),
  passportOverrideD: z.string().trim().optional(),
});

export type TransplantRequest = z.infer<typeof TransplantRequestSchema>;

export const TransplantResponseSchema = z.object({
  childBatchId: z.string().uuid(),
  childBatchNumber: z.string(),
  parentRemainingUnits: z.number().int().nonnegative(),
});
export type TransplantResponse = z.infer<typeof TransplantResponseSchema>;
