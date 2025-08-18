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
