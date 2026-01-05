"use server"

import { featureSchema, type FeatureFormValues } from "./schema"
import { revalidatePath } from "next/cache"

/**
 * Server Actions for the Feature.
 * Standardized pattern for CRUD operations with error handling.
 */

export async function createFeatureAction(values: FeatureFormValues) {
  // Validate input server-side
  const validated = featureSchema.safeParse(values)
  if (!validated.success) {
    return { success: false, error: "Invalid input" }
  }

  try {
    // 1. Database logic here (e.g., supabase.from('...').insert(...))
    console.log("Creating feature:", validated.data)

    // 2. Revalidate paths
    revalidatePath("/path-to-feature")
    
    return { success: true, data: validated.data }
  } catch (error) {
    console.error("Error creating feature:", error)
    return { success: false, error: "Failed to create feature" }
  }
}

export async function updateFeatureAction(id: string, values: FeatureFormValues) {
  const validated = featureSchema.safeParse(values)
  if (!validated.success) {
    return { success: false, error: "Invalid input" }
  }

  try {
    // 1. Database logic here
    console.log("Updating feature:", id, validated.data)

    // 2. Revalidate
    revalidatePath("/path-to-feature")
    
    return { success: true, data: validated.data }
  } catch (error) {
    return { success: false, error: "Failed to update feature" }
  }
}

export async function deleteFeatureAction(id: string) {
  try {
    // 1. Database logic here
    console.log("Deleting feature:", id)

    // 2. Revalidate
    revalidatePath("/path-to-feature")
    
    return { success: true }
  } catch (error) {
    return { success: false, error: "Failed to delete feature" }
  }
}


