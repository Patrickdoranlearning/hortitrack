import { z } from "zod";

export const ProductionProtocolStepSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string().optional(),
  day: z.number().int().nonnegative().optional(),
  at: z.string().optional(),
  durationDays: z.number().int().nonnegative().optional(),
  params: z.record(z.any()).optional(),
});

export const ProductionTargetsSchema = z.object({
  tempC: z.object({ day: z.number().nullable().optional(), night: z.number().nullable().optional() }).optional(),
  humidityPct: z.number().nullable().optional(),
  lightHours: z.number().nullable().optional(),
  ec: z.number().nullable().optional(),
  ph: z.number().nullable().optional(),
  spacing: z.union([z.number(), z.string()]).nullable().optional(),
});

export const ProductionProtocolRouteNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  stageName: z.string().optional(),
  locationName: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  durationDays: z.number().int().nonnegative().optional(),
});
export const ProductionProtocolRouteEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});
export const ProductionProtocolRouteSchema = z.object({
  nodes: z.array(ProductionProtocolRouteNodeSchema),
  edges: z.array(ProductionProtocolRouteEdgeSchema),
});

export const ProductionProtocolOutputSchema = z.object({
  protocolTitle: z.string().optional(),
  summary: z.string().optional(),
  timeline: z.array(z.object({
    day: z.number(),
    action: z.string(),
    details: z.string(),
    date: z.string().optional(),
  })).optional(),
  recommendations: z.array(z.string()).optional(),
  targets: ProductionTargetsSchema.optional(),
  steps: z.array(ProductionProtocolStepSchema).default([]),
  route: ProductionProtocolRouteSchema.optional(),
});
export type ProductionProtocolOutput = z.infer<typeof ProductionProtocolOutputSchema>;
