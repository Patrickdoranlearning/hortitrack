import { getSupabaseServerApp } from "@/server/db/supabase";

// Helper to extract joined record (Supabase may return array or object)
type MediaLibraryJoin = { id: string; file_path: string; uploaded_at: string | null } | null;
function extractMediaLibrary(joined: unknown): MediaLibraryJoin {
  if (!joined) return null;
  if (Array.isArray(joined)) return joined[0] as MediaLibraryJoin ?? null;
  return joined as MediaLibraryJoin;
}

export type GalleryImage = {
  id: string; // media_library id (used for delete)
  attachmentId?: string; // media_attachments id (for debugging/audit)
  url: string;
  badge?: string;
  caption?: string;
  isHero: boolean;
  priority: number; // 1 = batch (live crop), 2 = variety (reference), 3 = product (size guide)
  displayOrder: number;
  entityType: "batch" | "variety" | "product";
  entityId: string;
  uploadedAt: string;
};

export type SmartGalleryParams = {
  batchId?: string | null;
  varietyId?: string | null;
  productId?: string | null;
  orgId: string;
};

/**
 * Get a prioritized gallery of images for display
 * Priority order: Batch photos (live crop) > Variety photos (reference) > Product photos (size guide)
 */
export async function getSmartGallery(
  params: SmartGalleryParams
): Promise<GalleryImage[]> {
  const { batchId, varietyId, productId, orgId } = params;

  // If no entity IDs provided, return empty array
  if (!batchId && !varietyId && !productId) {
    return [];
  }

  const supabase = await getSupabaseServerApp();

  // Build query conditions for PostgREST .or with grouped and() clauses
  const conditions: string[] = [];
  if (batchId) {
    conditions.push(`and(entity_type.eq.batch,entity_id.eq.${batchId})`);
  }
  if (varietyId) {
    conditions.push(`and(entity_type.eq.variety,entity_id.eq.${varietyId})`);
  }
  if (productId) {
    conditions.push(`and(entity_type.eq.product,entity_id.eq.${productId})`);
  }

  const query = supabase
    .from("media_attachments")
    .select(
      `
      id,
      entity_type,
      entity_id,
      display_order,
      caption,
      badge_type,
      is_hero,
      created_at,
      media_library (
        id,
        file_path,
        uploaded_at
      )
    `
    )
    .eq("org_id", orgId);

  if (conditions.length > 0) {
    query.or(conditions.join(","));
  }

  // Fetch all matching attachments with their media
  const { data: attachments, error } = await query;

  if (error) {
    console.error("[getSmartGallery] query error:", error);
    return [];
  }

  if (!attachments || attachments.length === 0) {
    return [];
  }

  // Transform and sort by priority
  const images: GalleryImage[] = attachments
    .map((a) => ({ ...a, media: extractMediaLibrary(a.media_library) }))
    .filter((a) => a.media?.file_path)
    .map((a) => {
      const media = a.media!;
      // Determine priority based on entity type
      let priority: number;
      switch (a.entity_type) {
        case "batch":
          priority = 1;
          break;
        case "variety":
          priority = 2;
          break;
        case "product":
          priority = 3;
          break;
        default:
          priority = 99;
      }

      // Generate badge text if badge_type is set
      let badge: string | undefined;
      if (a.badge_type) {
        switch (a.badge_type) {
          case "live_crop":
            badge = `Live Crop: ${new Date(a.created_at || "").toLocaleDateString()}`;
            break;
          case "reference":
            badge = "Reference Image";
            break;
          case "size_guide":
            badge = "Size Reference";
            break;
          default:
            badge = a.badge_type;
        }
      } else {
        // Auto-generate badge based on entity type
        switch (a.entity_type) {
          case "batch":
            badge = `Live Crop: ${new Date(a.created_at || "").toLocaleDateString()}`;
            break;
          case "variety":
            badge = "Reference Image";
            break;
          case "product":
            badge = "Size Reference";
            break;
        }
      }

      return {
        id: media.id, // use media id so delete works
        attachmentId: a.id,
        url: media.file_path,
        badge,
        caption: a.caption ?? undefined,
        isHero: a.is_hero ?? false,
        priority,
        displayOrder: a.display_order ?? 0,
        entityType: a.entity_type as "batch" | "variety" | "product",
        entityId: a.entity_id,
        uploadedAt: media.uploaded_at || a.created_at || "",
      };
    });

  // Sort by priority (ascending), then by display_order (ascending)
  images.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.displayOrder - b.displayOrder;
  });

  return images;
}

/**
 * Get gallery images for a specific entity
 */
export async function getEntityGallery(
  entityType: "batch" | "variety" | "product",
  entityId: string,
  orgId: string
): Promise<GalleryImage[]> {
  const params: SmartGalleryParams = { orgId };
  
  switch (entityType) {
    case "batch":
      params.batchId = entityId;
      break;
    case "variety":
      params.varietyId = entityId;
      break;
    case "product":
      params.productId = entityId;
      break;
  }
  
  return getSmartGallery(params);
}

/**
 * Convert smart gallery to format expected by CustomerCatalogProduct
 */
export function galleryToProductFormat(
  images: GalleryImage[]
): Array<{ url: string; badge?: string }> {
  return images.map((img) => ({
    url: img.url,
    badge: img.badge,
  }));
}



