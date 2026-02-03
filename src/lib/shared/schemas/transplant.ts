/**
 * Shared Transplant Schemas
 *
 * Validation schemas used by both main app and worker app
 * for transplant (moving plants from parent to child batch) operations.
 */

import { z } from "zod";

/**
 * Base schema for transplant - core fields shared across all contexts
 */
export const transplantBaseSchema = z.object({
  parentBatchId: z.string().uuid("Invalid parent batch ID"),
  sizeId: z.string().uuid("Invalid size ID"),
  locationId: z.string().uuid("Invalid location ID"),
  notes: z.string().max(1000, "Notes too long").optional(),
  archiveParentIfEmpty: z.boolean().optional().default(true),
});

/**
 * Worker app transplant schema - uses containers count with write-off options
 */
export const workerTransplantSchema = transplantBaseSchema.extend({
  containers: z.number().int().positive("Containers must be positive"),
  writeOffRemainder: z.boolean().optional().default(false),
  remainderUnits: z.number().int().min(0).optional(),
});

/**
 * Validation refinement for write-off remainder
 * If writeOffRemainder is true, remainderUnits should be provided
 */
export const workerTransplantSchemaRefined = workerTransplantSchema.refine(
  (data) => {
    if (data.writeOffRemainder && (data.remainderUnits === undefined || data.remainderUnits < 0)) {
      return false;
    }
    return true;
  },
  {
    message: "Remainder units required when writing off remainder",
    path: ["remainderUnits"],
  }
);

// Type exports
export type TransplantBase = z.infer<typeof transplantBaseSchema>;
export type WorkerTransplantInput = z.infer<typeof workerTransplantSchema>;
