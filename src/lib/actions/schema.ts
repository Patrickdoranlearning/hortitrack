
import { z } from "zod";

const PhotosSchema = z
  .array(
    z.object({
      url: z.string().url(),
      path: z.string().min(1),
      mime: z.string().min(1),
      size: z.number().int().positive(),
    })
  )
  .max(10)
  .optional();

const ActionTypeSchema = z.enum(["MOVE", "SPLIT", "DUMPED", "FLAGS", "NOTE"]);

const BaseSchema = z.object({
  actionId: z.string().uuid(),
  type: ActionTypeSchema,
  photos: PhotosSchema,
  // Fields for specific actions
  quantity: z.number().int().positive().optional(),
  reason: z.string().min(1).optional(),
  toLocationId: z.string().min(1).optional(),
  trimmed: z.boolean().optional(),
  spaced: z.boolean().optional(),
  note: z.string().max(2000).optional(),
  title: z.string().max(200).optional(),
  body: z.string().max(5000).optional(),
});

const BatchRefSchema = z.union([
    z.object({ batchNumber: z.string().min(1) }),
    z.object({ batchId: z.string().min(1) }),
    z.object({ batchIds: z.array(z.string().min(1)).nonempty() }),
]).transform((v) => {
    if ("batchNumber" in v) return { batchNumbers: [v.batchNumber], batchIds: [] as string[] };
    if ("batchId" in v) return { batchNumbers: [] as string[], batchIds: [v.batchId] };
    return { batchNumbers: [] as string[], batchIds: v.batchIds };
});


export const ActionInputSchema = z.intersection(BaseSchema, BatchRefSchema);

export type ActionInput = z.infer<typeof ActionInputSchema>;
