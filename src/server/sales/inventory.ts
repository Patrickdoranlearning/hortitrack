import "server-only";
import { createClient } from "@/lib/supabase/server";

export type InventoryBatch = {
    id: string;
    batchNumber?: string;
    plantVariety?: string;
    size?: string;
    status?: string;
    qcStatus?: string;
    quantity?: number;
    grade?: string;
    location?: string;
    plantingDate?: string;
    createdAt?: string;
    hidden?: boolean;
    category?: string;
    growerPhotoUrl?: string;
    salesPhotoUrl?: string;
};

export async function getSaleableBatches(): Promise<InventoryBatch[]> {
    const supabase = await createClient();

    // Fetch available batches
    // Criteria: Status is "Ready for Sale" or "Looking Good", Quantity > 0
    const { data, error } = await supabase
        .from("batches")
        .select("*, plant_varieties(name), plant_sizes(name), nursery_locations(name)")
        .in("status", ["Ready for Sale", "Looking Good"])
        .gt("quantity", 0);

    if (error) {
        console.error("Error fetching saleable batches:", error);
        return [];
    }

    return (data || []).map((d: any) => ({
        id: d.id,
        batchNumber: d.batch_number,
        plantVariety: d.plant_varieties?.name ?? null,
        size: d.plant_sizes?.name ?? null,
        status: d.status,
        qcStatus: d.qc_status,
        quantity: d.quantity,
        grade: d.grade,
        location: d.nursery_locations?.name ?? null,
        plantingDate: d.planting_date,
        createdAt: d.created_at,
        hidden: d.hidden,
        category: d.category,
        growerPhotoUrl: d.grower_photo_url,
        salesPhotoUrl: d.sales_photo_url,
    }));
}
