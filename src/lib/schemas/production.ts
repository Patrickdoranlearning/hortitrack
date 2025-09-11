import { z } from 'zod';

export const PropagationInput = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  containers: z.number().int().positive(),
  planted_at: z.string().date().or(z.date()).transform(d => new Date(d)),
  supplier_id: z.string().uuid().nullable().optional(), // defaults if needed
});

export type PropagationInput = z.infer<typeof PropagationInput>;
