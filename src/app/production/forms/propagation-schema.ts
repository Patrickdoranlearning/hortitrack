import { z } from "zod";

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
});

export type PropagationFormValues = z.infer<typeof propagationFormSchema>;

