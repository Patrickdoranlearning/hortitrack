import { z } from "zod"

/**
 * Zod schema for the Starter Feature.
 * Define your fields here to ensure consistency between the form,
 * server actions, and the database.
 */
export const featureSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  // Add other fields here...
})

export type FeatureFormValues = z.infer<typeof featureSchema>


