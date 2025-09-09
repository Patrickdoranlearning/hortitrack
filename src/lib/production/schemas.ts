import { z } from "zod";

export const PropagationInputSchema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  containers: z.number().int().min(1),
  planted_at: z.string().date().optional(), // ISO date
  notes: z.string().max(1000).optional(),
});

export type PropagationInput = z.infer<typeof PropagationInputSchema>;

export const CheckInInputSchema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  phase: z.enum(["propagation","plug","potted"]), // mapped to production_phase
  supplier_id: z.string().uuid(),
  containers: z.number().int().min(1),
  supplier_batch_number: z.string().max(120),
  incoming_date: z.string().date(),
  quality_rating: z.number().int().min(1).max(6).optional(),
  pest_or_disease: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  // images uploaded separately to storage; here we accept URLs/paths if already uploaded
  photo_urls: z.array(z.string().url()).max(3).optional(),
});

export type CheckInInput = z.infer<typeof CheckInInputSchema>;
