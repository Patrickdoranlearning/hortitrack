import "server-only";
import { getUserAndOrg } from "@/server/auth/org";
import { logError } from "@/lib/log";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Shape returned by the `get_saleable_batches` RPC */
interface SaleableBatchRpcRow {
    id: string;
    batch_number: string | null;
    plant_variety: string | null;
    size: string | null;
    status: string | null;
    qc_status: string | null;
    quantity: number | null;
    reserved_quantity: number | null;
    available_quantity: number | null;
    grade: string | null;
    location: string | null;
    planting_date: string | null;
    created_at: string | null;
    hidden: boolean | null;
    category: string | null;
    grower_photo_url: string | null;
    sales_photo_url: string | null;
}

/** Shape returned by the fallback batches query with joins */
interface FallbackBatchRow {
    id: string;
    batch_number: string | null;
    quantity: number | null;
    reserved_quantity: number | null;
    grade: string | null;
    planting_date: string | null;
    created_at: string | null;
    hidden: boolean | null;
    category: string | null;
    grower_photo_url: string | null;
    sales_photo_url: string | null;
    status: string | null;
    qc_status: string | null;
    plant_varieties: { name: string | null } | null;
    plant_sizes: { name: string | null } | null;
    nursery_locations: { name: string | null } | null;
    attribute_options: { behavior: string | null; display_label: string | null } | null;
}

export type InventoryBatch = {
    id: string;
    batchNumber?: string;
    plantVariety?: string;
    size?: string;
    status?: string;
    qcStatus?: string;
    quantity?: number;
    reservedQuantity?: number;
    availableQuantity?: number;
    grade?: string;
    location?: string;
    plantingDate?: string;
    createdAt?: string;
    hidden?: boolean;
    category?: string;
    growerPhotoUrl?: string;
    salesPhotoUrl?: string;
};

/**
 * Get saleable batches using optimized SQL RPC
 * - Filtering, sorting, and availability calculations done in SQL
 * - Returns only batches with available quantity > 0
 * - Already sorted by FEFO (planting_date ASC, created_at ASC, grade ASC)
 */
export async function getSaleableBatches(): Promise<InventoryBatch[]> {
    const { supabase, orgId } = await getUserAndOrg();

    // Use optimized RPC that does filtering/sorting in SQL
    const { data, error } = await supabase.rpc("get_saleable_batches", {
        p_org_id: orgId,
    });

    if (error) {
        logError("Error fetching saleable batches", { error: error.message });
        // Fallback to direct query if RPC doesn't exist yet
        return getSaleableBatchesFallback(supabase);
    }

    return (data || []).map((d: SaleableBatchRpcRow) => ({
        id: d.id,
        batchNumber: d.batch_number ?? undefined,
        plantVariety: d.plant_variety ?? undefined,
        size: d.size ?? undefined,
        status: d.status ?? undefined,
        qcStatus: d.qc_status ?? undefined,
        quantity: d.quantity ?? undefined,
        reservedQuantity: d.reserved_quantity ?? undefined,
        availableQuantity: d.available_quantity ?? undefined,
        grade: d.grade ?? undefined,
        location: d.location ?? undefined,
        plantingDate: d.planting_date ?? undefined,
        createdAt: d.created_at ?? undefined,
        hidden: d.hidden ?? undefined,
        category: d.category ?? undefined,
        growerPhotoUrl: d.grower_photo_url ?? undefined,
        salesPhotoUrl: d.sales_photo_url ?? undefined,
    }));
}

/**
 * Fallback query for when RPC is not yet deployed
 */
async function getSaleableBatchesFallback(supabase: SupabaseClient): Promise<InventoryBatch[]> {
    const { data, error } = await supabase
        .from("batches")
        .select(`
            *,
            plant_varieties(name),
            plant_sizes(name),
            nursery_locations(name),
            attribute_options!inner(behavior, display_label)
        `)
        .eq("attribute_options.behavior", "available")
        .in("attribute_options.display_label", ["Ready for Sale", "Looking Good"])
        .gt("quantity", 0);

    if (error) {
        logError("Error fetching saleable batches (fallback)", { error: error.message });
        return [];
    }

    return (data || [])
        .map((d: FallbackBatchRow) => {
            const quantity = d.quantity ?? 0;
            const reservedQuantity = d.reserved_quantity ?? 0;
            const availableQuantity = Math.max(0, quantity - reservedQuantity);

            return {
                id: d.id,
                batchNumber: d.batch_number ?? undefined,
                plantVariety: d.plant_varieties?.name ?? undefined,
                size: d.plant_sizes?.name ?? undefined,
                status: d.attribute_options?.display_label ?? d.status ?? undefined,
                qcStatus: d.qc_status ?? undefined,
                quantity,
                reservedQuantity,
                availableQuantity,
                grade: d.grade ?? undefined,
                location: d.nursery_locations?.name ?? undefined,
                plantingDate: d.planting_date ?? undefined,
                createdAt: d.created_at ?? undefined,
                hidden: d.hidden ?? undefined,
                category: d.category ?? undefined,
                growerPhotoUrl: d.grower_photo_url ?? undefined,
                salesPhotoUrl: d.sales_photo_url ?? undefined,
            };
        })
        .filter((b: { availableQuantity: number }) => b.availableQuantity > 0);
}
