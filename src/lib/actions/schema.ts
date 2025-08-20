
import { z } from "zod";

const PhotosSchema = z.array(z.object({
  url: z.string().url(),
  path: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().positive(),
})).max(10).optional();

export const MoveActionSchema = z.object({
  type: z.literal("MOVE"),
  batchIds: z.array(z.string()).min(1),
  toLocationId: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  actionId: z.string().uuid(),
  note: z.string().max(2000).optional(),
  photos: PhotosSchema,
});

export const SplitActionSchema = z.object({
  type: z.literal("SPLIT"),
  batchIds: z.array(z.string()).length(1),
  toLocationId: z.string().min(1),
  splitQuantity: z.number().int().positive(),
  actionId: z.string().uuid(),
  note: z.string().max(2000).optional(),
  photos: PhotosSchema,
});

export const FlagsActionSchema = z.object({
  type: z.literal("FLAGS"),
  batchIds: z.array(z.string()).min(1),
  trimmed: z.boolean().default(false),
  spaced: z.boolean().default(false),
  actionId: z.string().uuid(),
  note: z.string().max(2000).optional(),
  photos: PhotosSchema,
});

export const NoteActionSchema = z.object({
  type: z.literal("NOTE"),
  batchIds: z.array(z.string()).min(1),
  title: z.string().min(1).max(200),
  body: z.string().max(5000).optional(),
  actionId: z.string().uuid(),
  photos: PhotosSchema,
});

export const ActionInputSchema = z.discriminatedUnion("type", [
  MoveActionSchema,
  SplitActionSchema,
  FlagsActionSchema,
  NoteActionSchema,
]);

export type ActionInput = z.infer<typeof ActionInputSchema>;
