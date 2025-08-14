import { z } from 'zod';

// This is the simplified, universal LogEntry shape for data transfer.
export const LogEntrySchema = z.object({
  id: z.string(),
  date: z.any(),
  type: z.string(),
  note: z.string().optional(),
  qty: z.number().optional(),
  reason: z.string().optional(),
  newLocation: z.string().optional(),
  newLocationId: z.string().optional(),
  fromBatch: z.string().optional(),
  toBatch: z.string().optional(),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

// This is the client-side form validation schema.
// It will be defined inside the form component that uses it.
export type ActionLogFormValues = {
  type: 'NOTE' | 'MOVE' | 'LOSS';
  note?: string;
  newLocation?: string;
  newLocationId?: string;
  qty?: number;
  reason?: string;
};

// ---- Domain types ----

export const BatchStatus = z.enum([
  'Propagation',
  'Plugs/Liners',
  'Potted',
  'Ready for Sale',
  'Looking Good',
  'Archived',
]);

export const BatchSchema = z.object({
  id: z.string().optional(),
  batchNumber: z.string(),
  category: z.string(),
  plantFamily: z.string(),
  plantVariety: z.string(),
  plantingDate: z.string(), // ISO
  initialQuantity: z.number(),
  quantity: z.number(),
  status: BatchStatus,
  location: z.string(),
  locationId: z.string().optional(),
  size: z.string(),
  logHistory: z.array(LogEntrySchema),
  transplantedFrom: z.string().optional(),
  supplier: z.string().optional(),
  growerPhotoUrl: z.string().optional(),
  salesPhotoUrl: z.string().optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});
export type Batch = z.infer<typeof BatchSchema>;

export const VarietySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Variety name is required'),
  commonName: z.string().optional(),
  family: z.string().min(1, 'Family is required'),
  category: z.string().min(1, 'Category is required'),
  grouping: z.string().optional(),
  rating: z.string().optional(),
  salesPeriod: z.string().optional(),
  floweringPeriod: z.string().optional(),
  flowerColour: z.string().optional(),
  evergreen: z.string().optional(),
});
export type Variety = z.infer<typeof VarietySchema>;

export const NurseryLocationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  nursery: z.string().min(1),
  type: z.string().min(1), // e.g., "Tunnel", "Section", ...
  area: z.coerce.number().nonnegative().optional(),
  isCovered: z.boolean().optional(),
});
export type NurseryLocation = z.infer<typeof NurseryLocationSchema>;

export const PlantSizeSchema = z.object({
  id: z.string().optional(),
  size: z.string().min(1), // e.g., "10.5", "54"
  type: z.enum(['Tray', 'Pot', 'Bareroot']),
  area: z.coerce.number().nonnegative(),
  shelfQuantity: z.coerce.number().nonnegative(),
  multiple: z.coerce.number().positive(),
});
export type PlantSize = z.infer<typeof PlantSizeSchema>;

export const SupplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  address: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  producerCode: z.string().optional(),
});
export type Supplier = z.infer<typeof SupplierSchema>;


// ---- AI flow output types ----

/**
 * Output schema for the Production Protocol AI flow.
 * Matches the shape used by <ProductionProtocolDialog />.
 */
export const ProductionProtocolOutputSchema = z.object({
    protocolTitle: z.string().describe('A descriptive title for the production protocol.'),
    summary: z.string().describe('A brief summary of the protocol and its objective.'),
    timeline: z.array(z.object({
      day: z.number().describe('The day in the production cycle (e.g., 0, 15, 30).'),
      action: z.string().describe('The key action or task to be performed on this day.'),
      date: z.string().describe('The calendar date of the action'),
      details: z.string().describe('Specific instructions or notes for the action.'),
    })).describe('A timeline of key production stages and actions.'),
    recommendations: z.array(z.string()).describe('Additional recommendations for optimizing future batches based on this protocol.'),
  });
export type ProductionProtocolOutput = z.infer<typeof ProductionProtocolOutputSchema>;
