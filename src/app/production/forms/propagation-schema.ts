import { z } from "zod";

export const plannedMaterialSchema = z.object({
  material_id: z.string().uuid(),
  name: z.string(),
  part_number: z.string(),
  category_code: z.string(),
  base_uom: z.string(),
  quantity: z.coerce.number().positive("Must be > 0"),
  notes: z.string().optional(),
});

export type PlannedMaterialInput = z.infer<typeof plannedMaterialSchema>;

export const propagationFormSchema = z.object({
  varietyId: z.string().min(1, "Required"),
  variety: z.string().optional(), // optional display name
  family: z.string().optional(),
  sizeId: z.string().min(1, "Required"),
  sizeMultiple: z.coerce.number().int().positive("Must be > 0"),
  fullTrays: z.coerce.number().int().min(0),
  partialCells: z.coerce.number().int().min(0).default(0),
  locationId: z.string().min(1, "Required"),
  plantingDate: z.string().min(1, "Required"),
  materials: z.array(plannedMaterialSchema).optional().default([]),
});

export type PropagationFormValues = z.infer<typeof propagationFormSchema>;

