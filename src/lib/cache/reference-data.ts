import "server-only";
import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { logger } from "@/server/utils/logger";

// ============================================================
// IN-MEMORY CACHE (works in development mode)
// ============================================================

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in ms

function getFromMemoryCache<T>(key: string, ttl = DEFAULT_TTL): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > ttl) {
    memoryCache.delete(key);
    return null;
  }
  
  return entry.data as T;
}

function setInMemoryCache<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

export function invalidateMemoryCache(pattern?: string): void {
  if (!pattern) {
    memoryCache.clear();
    return;
  }
  
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
}

// ============================================================
// TYPES
// ============================================================

export type CachedReferenceData = {
  varieties: Array<{
    id: string;
    name: string;
    family?: string | null;
    genus?: string | null;
    species?: string | null;
    category?: string | null;
  }>;
  sizes: Array<{
    id: string;
    name: string;
    container_type?: string | null;
    cell_multiple?: number | null;
  }>;
  locations: Array<{
    id: string;
    name: string;
    covered?: boolean | null;
    area?: string | null;
    nursery_site?: string | null;
  }>;
  suppliers: Array<{
    id: string;
    name: string;
    producer_code?: string | null;
    country_code?: string | null;
  }>;
  materials: Array<{
    id: string;
    name: string;
    part_number: string;
    category_id: string;
    category_name?: string | null;
    category_code?: string | null;
    parent_group?: string | null;
    base_uom: string;
    linked_size_id?: string | null;
    is_active: boolean;
  }>;
};

// ============================================================
// REFERENCE DATA FETCHING (uses service_role - no auth overhead)
// ============================================================

/**
 * Fetch all reference data using RPC (single round-trip)
 * Uses service_role to bypass auth - safe for read-only reference data
 */
async function fetchReferenceDataViaRPC(orgId: string): Promise<CachedReferenceData | null> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase.rpc("get_reference_data", {
    p_org_id: orgId,
  });

  if (error || !data || data.length === 0) {
    if (error) logger.cache.warn("RPC get_reference_data failed", { error: error.message });
    return null;
  }

  const row = data[0];
  return {
    varieties: row.varieties ?? [],
    sizes: row.sizes ?? [],
    locations: row.locations ?? [],
    suppliers: row.suppliers ?? [],
    materials: row.materials ?? [],
  };
}

/**
 * Fetch all reference data using parallel queries (fallback)
 * Uses service_role to bypass auth
 */
async function fetchReferenceDataDirect(orgId: string): Promise<CachedReferenceData> {
  const supabase = getSupabaseAdmin();

  // Run all queries in parallel
  const [varietiesRes, sizesRes, locationsRes, suppliersRes, materialsRes] = await Promise.all([
    supabase
      .from("plant_varieties")
      .select("id, name, family, genus, species, category")
      .order("name"),
    supabase
      .from("plant_sizes")
      .select("id, name, container_type, cell_multiple")
      .order("name"),
    supabase
      .from("nursery_locations")
      .select("id, name, covered, area, nursery_site")
      .eq("org_id", orgId)
      .order("name"),
    supabase
      .from("suppliers")
      .select("id, name, producer_code, country_code")
      .eq("org_id", orgId)
      .order("name"),
    // Fetch materials for containers and growing media only (for planning wizard)
    supabase
      .from("materials")
      .select(`
        id,
        name,
        part_number,
        category_id,
        base_uom,
        linked_size_id,
        is_active,
        category:material_categories(name, code, parent_group)
      `)
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name"),
  ]);

  // Transform materials to flatten category info and filter to Containers + Growing Media
  const materials = (materialsRes.data ?? [])
    .filter((m: any) => {
      const parentGroup = m.category?.parent_group;
      return parentGroup === "Containers" || parentGroup === "Growing Media";
    })
    .map((m: any) => ({
      id: m.id,
      name: m.name,
      part_number: m.part_number,
      category_id: m.category_id,
      category_name: m.category?.name ?? null,
      category_code: m.category?.code ?? null,
      parent_group: m.category?.parent_group ?? null,
      base_uom: m.base_uom,
      linked_size_id: m.linked_size_id ?? null,
      is_active: m.is_active,
    }));

  return {
    varieties: varietiesRes.data ?? [],
    sizes: sizesRes.data ?? [],
    locations: locationsRes.data ?? [],
    suppliers: suppliersRes.data ?? [],
    materials,
  };
}

/**
 * Get reference data with in-memory caching (works in dev mode)
 * Uses service_role to bypass auth for read-only data
 * 
 * @param orgId - The organization ID
 * @returns Cached reference data
 */
export async function getCachedReferenceData(orgId: string): Promise<CachedReferenceData> {
  const cacheKey = `reference-data-${orgId}`;
  
  // Check memory cache first
  const cached = getFromMemoryCache<CachedReferenceData>(cacheKey);
  if (cached) {
    return cached;
  }

  // Try RPC first (single round-trip)
  let data = await fetchReferenceDataViaRPC(orgId);
  
  // Fall back to direct queries if RPC fails
  if (!data) {
    data = await fetchReferenceDataDirect(orgId);
  }

  // Cache in memory
  setInMemoryCache(cacheKey, data);
  
  return data;
}

/**
 * Get cached reference data with Next.js cache (for production)
 * Falls back to in-memory cache in development
 */
export const getCachedReferenceDataForOrg = process.env.NODE_ENV === "production"
  ? (orgId: string) => unstable_cache(
      () => getCachedReferenceData(orgId),
      ["reference-data", orgId],
      { revalidate: 300, tags: ["reference-data", `reference-data-${orgId}`] }
    )()
  : getCachedReferenceData;

// ============================================================
// LOCATIONS ONLY (lightweight)
// ============================================================

/**
 * Fetch locations using service_role (no auth overhead)
 */
async function fetchLocationsForOrg(orgId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("nursery_locations")
    .select("id, name, covered, area, nursery_site, type, site_id, updated_at, created_at")
    .eq("org_id", orgId)
    .order("name");

  if (error) {
    logger.cache.error("fetchLocationsForOrg failed", { error });
    return [];
  }
  return data ?? [];
}

type LocationData = Awaited<ReturnType<typeof fetchLocationsForOrg>>;

/**
 * Get cached locations with in-memory caching
 */
export async function getCachedLocations(orgId: string): Promise<LocationData> {
  const cacheKey = `locations-${orgId}`;
  
  // Check memory cache first
  const cached = getFromMemoryCache<LocationData>(cacheKey);
  if (cached) {
    return cached;
  }

  const locations = await fetchLocationsForOrg(orgId);
  setInMemoryCache(cacheKey, locations);
  
  return locations;
}

