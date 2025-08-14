
import { z } from 'zod';

export const LogEntrySchema = z.object({
  id: z.string().optional(),
  date: z.any(), // serverTimestamp or string
  type: z.enum([
    'NOTE',
    'LOSS',
    'ADJUST',
    'MOVE',
    'TRANSPLANT_TO',
    'TRANSPLANT_FROM',
    'CREATE',
    'ARCHIVE',
    'Batch Spaced',
    'Batch Trimmed',
  ]),
  qty: z.number().nullable().optional(),
  fromBatch: z.string().optional(),
  toBatch: z.string().optional(),
  newLocation: z.string().optional(),
  note: z.string().optional(),
  reason: z.string().optional(),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

export const BatchSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  category: z.string(),
  plantFamily: z.string(),
  plantVariety: z.string(),
  plantingDate: z.string(),
  initialQuantity: z.number(),
  quantity: z.number(),
  status: z.enum(['Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good', 'Archived']),
  location: z.string(),
  size: z.string(),
  logHistory: z.array(LogEntrySchema),
  transplantedFrom: z.string().optional(),
  supplier: z.string().optional(),
  growerPhotoUrl: z.string().optional(), // Added for grower photo URL
  salesPhotoUrl: z.string().optional(), // Added for sales photo URL
  createdAt: z.any(), // serverTimestamp
  updatedAt: z.any(), // serverTimestamp
});
export type Batch = z.infer<typeof BatchSchema>;

export type TransplantFormData = Omit<Batch, 'id' | 'initialQuantity' | 'logHistory' | 'createdAt' | 'updatedAt'> & {
    initialQuantity: number;
    logRemainingAsLoss: boolean;
};

// Moved from ai/flows/production-protocol.ts to avoid 'use server' export errors.
export const ProductionProtocolOutputSchema = z.object({
  protocolTitle: z.string().describe('A descriptive title for the production protocol.'),
  summary: z.string().describe('A brief summary of the protocol and its objective.'),
  timeline: z.array(z.object({
    day: z.number().describe('The day in the production cycle (e.g., 0, 15, 30).'),
    action: z.string().describe('The key action or task to be performed on this day.'),
    details: z.string().describe('Specific instructions or notes for the action.'),
  })).describe('A timeline of key production stages and actions.'),
  recommendations: z.array(z.string()).describe('Additional recommendations for optimizing future batches based on this protocol.'),
});
export type ProductionProtocolOutput = z.infer<typeof ProductionProtocolOutputSchema>;

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Location name is required.'),
  area: z.coerce.number().min(0, 'Area must be a positive number.'),
  isCovered: z.boolean(),
  nursery: z.string().optional(),
  type: z.string().min(1, 'Type is required.'),
});
export type NurseryLocation = z.infer<typeof LocationSchema>;

export const PlantSizeSchema = z.object({
  id: z.string(),
  size: z.string().min(1, 'Size name is required.'),
  type: z.enum(['Tray', 'Pot', 'Bareroot']),
  area: z.coerce.number().min(0, 'Area must be a positive number.'),
  shelfQuantity: z.coerce.number().min(0, 'Shelf quantity must be a positive number.'),
  multiple: z.coerce.number().min(0, 'Multiple must be a positive number.').optional(),
});
export type PlantSize = z.infer<typeof PlantSizeSchema>;

export const SupplierSchema = z.object({
    id: z.string(),
    name: z.string().min(1, 'Supplier name is required.'),
    address: z.string().optional(),
    country: z.string().optional(),
    countryCode: z.string().optional(),
    producerCode: z.string().optional(),
});
export type Supplier = z.infer<typeof SupplierSchema>;

export const VarietySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Variety name is required.'),
  family: z.string().min(1, 'Plant family is required.'),
  category: z.string().min(1, 'Category is required.'),
  grouping: z.string().optional(),
  commonName: z.string().optional(),
  rating: z.string().optional(),
  salesPeriod: z.string().optional(),
  floweringPeriod: z.string().optional(),
  flowerColour: z.string().optional(),
  evergreen: z.string().optional(),
});
export type Variety = z.infer<typeof VarietySchema>;


// Action Log Form Schema
export const ActionLogSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("NOTE"),
    note: z.string().min(1, "Please add a note."),
  }),
  z.object({
      type: z.literal("MOVE"),
      newLocation: z.string().optional(),
      newLocationId: z.string().optional(),
    })
    .refine((v) => Boolean(v.newLocation || v.newLocationId), {
      message: "Select a new location",
      path: ["newLocation"],
    }),
  z.object({
    type: z.literal("LOSS"),
    qty: z.coerce.number().min(1, "Enter a quantity greater than 0"),
    reason: z.string().optional(),
    note: z.string().optional(),
  }),
]);

export type ActionLogFormValues = z.infer<typeof ActionLogSchema>;
