// FULL FILE: src/lib/referenceData/schemas.ts
import { z } from "zod";

export const VarietySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  family: z.string().nullable().optional(),
  genus: z.string().nullable().optional(),
  species: z.string().nullable().optional(),
  Category: z.string().nullable().optional(),
  colour: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(6).nullable().optional(),
});

export const SizeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  container_type: z.string(),
  cell_multiple: z.number().int().min(1).nullable().optional(),
});

export const LocationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  nursery_site: z.string(),
});

export const SupplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  producer_code: z.string().nullable().optional(),
  country_code: z.string().length(2),
});

export const ReferenceDataSchema = z.object({
  varieties: z.array(VarietySchema),
  sizes: z.array(SizeSchema),
  locations: z.array(LocationSchema),
  suppliers: z.array(SupplierSchema),
});
