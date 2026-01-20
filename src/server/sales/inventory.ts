import "server-only";
import { getUserAndOrg } from "@/server/auth/org";

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
        console.error("Error fetching saleable batches:", error);
        // Fallback to direct query if RPC doesn't exist yet
        return getSaleableBatchesFallback(supabase);
    }

    return (data || []).map((d: any) => ({
        id: d.id,
        batchNumber: d.batch_number,
        plantVariety: d.plant_variety,
        size: d.size,
        status: d.status,
        qcStatus: d.qc_status,
        quantity: d.quantity,
        reservedQuantity: d.reserved_quantity,
        availableQuantity: d.available_quantity,
        grade: d.grade,
        location: d.location,
        plantingDate: d.planting_date,
        createdAt: d.created_at,
        hidden: d.hidden,
        category: d.category,
        growerPhotoUrl: d.grower_photo_url,
        salesPhotoUrl: d.sales_photo_url,
    }));
}

/**
 * Fallback query for when RPC is not yet deployed
 */
async function getSaleableBatchesFallback(supabase: any): Promise<InventoryBatch[]> {
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
        console.error("Error fetching saleable batches (fallback):", error);
        return [];
    }

    return (data || [])
        .map((d: any) => {
            const quantity = d.quantity ?? 0;
            const reservedQuantity = d.reserved_quantity ?? 0;
            const availableQuantity = Math.max(0, quantity - reservedQuantity);

            return {
                id: d.id,
                batchNumber: d.batch_number,
                plantVariety: d.plant_varieties?.name ?? null,
                size: d.plant_sizes?.name ?? null,
                status: d.attribute_options?.display_label ?? d.status,
                qcStatus: d.qc_status,
                quantity,
                reservedQuantity,
                availableQuantity,
                grade: d.grade,
                location: d.nursery_locations?.name ?? null,
                plantingDate: d.planting_date,
                createdAt: d.created_at,
                hidden: d.hidden,
                category: d.category,
                growerPhotoUrl: d.grower_photo_url,
                salesPhotoUrl: d.sales_photo_url,
            };
        })
        .filter((b: { availableQuantity: number }) => b.availableQuantity > 0);
}
