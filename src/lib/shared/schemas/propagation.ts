/**
 * Shared Propagation Schemas
 *
 * Validation schemas used by both main app and worker app
 * for propagation (starting seeds/cuttings) operations.
 */

import { z } from "zod";

/**
 * Base schema for propagation - core fields shared across all contexts
 */
export const propagationBaseSchema = z.object({
  plantVarietyId: z.string().uuid("Invalid variety ID"),
  sizeId: z.string().uuid("Invalid size ID"),
  locationId: z.string().uuid("Invalid location ID"),
  plantedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
    .optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
});

/**
 * Worker app propagation schema - uses containers count
 */
export const workerPropagationSchema = propagationBaseSchema.extend({
  containers: z.number().int().positive("Containers must be positive"),
});

/**
 * Main app propagation schema - uses fullTrays + partialCells
 * This matches the existing form schema for backward compatibility
 */
export const mainAppPropagationSchema = z.object({
  varietyId: z.string().min(1, "Required"),
  variety: z.string().optional(), // display name
  family: z.string().optional(),
  sizeId: z.string().min(1, "Required"),
  sizeMultiple: z.coerce.number().int().positive("Must be > 0"),
  fullTrays: z.coerce.number().int().min(0),
  partialCells: z.coerce.number().int().min(0).default(0),
  locationId: z.string().min(1, "Required"),
  plantingDate: z.string().min(1, "Required"),
});

// Type exports
export type PropagationBase = z.infer<typeof propagationBaseSchema>;
export type WorkerPropagationInput = z.infer<typeof workerPropagationSchema>;
export type MainAppPropagationInput = z.infer<typeof mainAppPropagationSchema>;
