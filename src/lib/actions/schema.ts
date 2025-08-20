
import { z } from "zod";

// Common attachments
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

const Base = z.object({
  actionId: z.string().uuid(),
  batchIds: z.array(z.string()).min(1),
  photos: PhotosSchema,
});

export const DumpedActionSchema = Base.extend({
  type: z.literal("DUMPED"),
  reason: z.string().min(1).max(500),
  quantity: z.number().int().positive(),
});

export const MoveActionSchema = Base.extend({
  type: z.literal("MOVE"),
  toLocationId: z.string().min(1, "Destination is required"),
  quantity: z.number().int().positive().optional(), // blank → full on server
  note: z.string().max(2000).optional(),
});

export const SplitActionSchema = Base.extend({
  type: z.literal("SPLIT"),
  batchIds: z.array(z.string()).length(1, "Split acts on one batch"),
  toLocationId: z.string().min(1),
  quantity: z.number().int().positive(),
  note: z.string().max(2000).optional(),
});

export const FlagsActionSchema = Base.extend({
  type: z.literal("FLAGS"),
  trimmed: z.boolean().optional(),
  spaced: z.boolean().optional(),
  note: z.string().max(2000).optional(),
});

export const NoteActionSchema = Base.extend({
  type: z.literal("NOTE"),
  body: z.string().max(5000).optional(),
  title: z.string().min(1).max(200),
});

export const ActionInputSchema = z.discriminatedUnion("type", [
  DumpedActionSchema,
  MoveActionSchema,
  SplitActionSchema,
  FlagsActionSchema,
  NoteActionSchema,
]);

export type ActionInput = z.infer<typeof ActionInputSchema>;
