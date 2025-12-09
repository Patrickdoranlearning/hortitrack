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

export async function getSaleableBatches(): Promise<InventoryBatch[]> {
    const supabase = await createClient();

    // Fetch available batches based on status behavior = 'available'
    // Include reserved_quantity to calculate true availability
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
        .gt("quantity", 0);

    if (error) {
        console.error("Error fetching saleable batches:", error);
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
        // Filter out batches with no available quantity
        .filter((b) => b.availableQuantity > 0);
}
