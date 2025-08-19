import { z } from "zod";

export const MoveActionSchema = z.object({
  type: z.literal("MOVE"),
  batchIds: z.array(z.string()).min(1),
  toLocationId: z.string().min(1),
  quantity: z.number().int().positive().optional(), // if omitted, move full batch
  actionId: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

export const SplitActionSchema = z.object({
  type: z.literal("SPLIT"),
  batchIds: z.array(z.string()).length(1), // split one batch at a time for safety
  toLocationId: z.string().min(1),
  splitQuantity: z.number().int().positive(),
  actionId: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

export const FlagsActionSchema = z.object({
  type: z.literal("FLAGS"),
  batchIds: z.array(z.string()).min(1),
  trimmed: z.boolean().default(false),
  spaced: z.boolean().default(false),
  actionId: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

export const NoteActionSchema = z.object({
  type: z.literal("NOTE"),
  batchIds: z.array(z.string()).min(1),
  title: z.string().min(1).max(200),
  body: z.string().max(5000).optional(),
  actionId: z.string().uuid(),
});

export const ActionInputSchema = z.discriminatedUnion("type", [
  MoveActionSchema,
  SplitActionSchema,
  FlagsActionSchema,
  NoteActionSchema,
]);

export type ActionInput = z.infer<typeof ActionInputSchema>;
export type MoveActionInput = z.infer<typeof MoveActionSchema>;
export type SplitActionInput = z.infer<typeof SplitActionSchema>;
export type FlagsActionInput = z.infer<typeof FlagsActionSchema>;
export type NoteActionInput = z.infer<typeof NoteActionSchema>;
