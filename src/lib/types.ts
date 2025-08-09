import { z } from 'zod';

export const LogEntrySchema = z.object({
  date: z.string(),
  action: z.string(),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

export const BatchSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
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
});
export type Batch = z.infer<typeof BatchSchema>;

export type TransplantFormData = Omit<Batch, 'id' | 'initialQuantity'> & {
    initialQuantity: number;
    archiveRemaining: boolean;
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
