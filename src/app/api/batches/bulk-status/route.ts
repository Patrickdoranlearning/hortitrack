import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";

const bulkSchema = z.object({
  batchIds: z.array(z.string().uuid()).min(1, "Select at least one batch."),
  // Status update via status_id (preferred)
  statusId: z.string().uuid().optional(),
  status: z.string().optional(), // The status text/systemCode
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const payload = bulkSchema.parse(json);

    const { orgId, supabase, user } = await getUserAndOrg();

    if (!payload.statusId && !payload.status) {
      return NextResponse.json(
        { error: "Provide statusId or status to update." },
        { status: 400 }
      );
    }

    // If statusId provided, verify it exists and get the system_code
    let statusId = payload.statusId;
    let statusCode = payload.status;
    let behavior: string | null = null;

    if (statusId) {
      const { data: statusOption, error: optError } = await supabase
        .from("attribute_options")
        .select("system_code, behavior")
        .eq("id", statusId)
        .eq("org_id", orgId)
        .eq("attribute_key", "production_status")
        .single();

      if (optError || !statusOption) {
        return NextResponse.json(
          { error: "Invalid status option." },
          { status: 400 }
        );
      }

      statusCode = statusOption.system_code;
      behavior = statusOption.behavior;
    } else if (statusCode) {
      // Look up by status text
      const { data: statusOption } = await supabase
        .from("attribute_options")
        .select("id, behavior")
        .eq("org_id", orgId)
        .eq("attribute_key", "production_status")
        .or(`system_code.eq.${statusCode},display_label.eq.${statusCode}`)
        .maybeSingle();

      if (statusOption) {
        statusId = statusOption.id;
        behavior = statusOption.behavior;
      }
    }

    // Build update payload
    const updatePayload: Record<string, any> = {
      status: statusCode,
      updated_at: new Date().toISOString(),
    };

    if (statusId) {
      updatePayload.status_id = statusId;
    }

    const { error } = await supabase
      .from("batches")
      .update(updatePayload)
      .in("id", payload.batchIds)
      .eq("org_id", orgId);

    if (error) {
      console.error("[bulk-status] update failed", error);
      return NextResponse.json({ error: "Failed to update batches." }, { status: 500 });
    }

    // Auto-link batches to products when behavior is "available"
    if (behavior === "available") {
      try {
        await autoLinkBatchesToProducts(supabase, orgId, payload.batchIds);
      } catch (linkError) {
        console.warn("[bulk-status] auto-link failed:", linkError);
        // Don't fail the status update if auto-link fails
      }
    }

    // Log events
    const metadata = {
      mode: "bulk",
      status: statusCode,
      statusId,
      behavior,
      note: payload.note ?? null,
    };

    const events = payload.batchIds.map((batchId) => ({
      batch_id: batchId,
      org_id: orgId,
      type: "STATUS_CHANGE",
      at: new Date().toISOString(),
      by_user_id: user.id,
      payload: JSON.stringify(metadata),
    }));

    const { error: eventError } = await supabase.from("batch_events").insert(events);
    if (eventError) {
      console.warn("[bulk-status] events insert failed", eventError);
    }

    return NextResponse.json({
      ok: true,
      updated: payload.batchIds.length,
      behavior,
    });
  } catch (error) {
    console.error("[bulk-status] unexpected", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}

/**
 * Auto-link batches to matching products when they become available.
 * First tries rules-based matching, then falls back to SKU variety+size matching.
 */
async function autoLinkBatchesToProducts(
  supabase: any,
  orgId: string,
  batchIds: string[]
) {
  // Get batch details with variety info
  const { data: batches, error: batchError } = await supabase
    .from("batches")
    .select(`
      id,
      plant_variety_id,
      size_id,
      location_id,
      status_id,
      planted_at,
      plant_variety:plant_varieties(id, name, family, genus, category)
    `)
    .in("id", batchIds)
    .eq("org_id", orgId);

  if (batchError || !batches?.length) {
    console.warn("[autoLinkBatchesToProducts] Could not fetch batches:", batchError);
    return;
  }

  // Fetch active mapping rules (ordered by priority)
  const { data: rules } = await supabase
    .from("product_mapping_rules")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  // Get existing product_batches to avoid duplicates
  const { data: existingLinks } = await supabase
    .from("product_batches")
    .select("batch_id, product_id")
    .in("batch_id", batchIds);

  const existingSet = new Set(
    (existingLinks ?? []).map((l: any) => `${l.product_id}:${l.batch_id}`)
  );

  const linksToCreate: Array<{ product_id: string; batch_id: string }> = [];

  // First pass: Try to match using rules
  const matchedBatchIds = new Set<string>();

  if (rules?.length) {
    for (const batch of batches) {
      const variety = batch.plant_variety as { family?: string; genus?: string; category?: string } | null;
      const batchAgeWeeks = batch.planted_at
        ? Math.floor((Date.now() - new Date(batch.planted_at).getTime()) / (7 * 24 * 60 * 60 * 1000))
        : null;

      // Find first matching rule
      for (const rule of rules) {
        // Check family match
        if (rule.match_family && variety?.family?.toLowerCase() !== rule.match_family.toLowerCase()) continue;
        
        // Check genus match
        if (rule.match_genus && variety?.genus?.toLowerCase() !== rule.match_genus.toLowerCase()) continue;
        
        // Check category match
        if (rule.match_category && variety?.category?.toLowerCase() !== rule.match_category.toLowerCase()) continue;
        
        // Check size match
        if (rule.match_size_id && batch.size_id !== rule.match_size_id) continue;
        
        // Check location match
        if (rule.match_location_id && batch.location_id !== rule.match_location_id) continue;
        
        // Check min age
        if (rule.min_age_weeks != null && (batchAgeWeeks == null || batchAgeWeeks < rule.min_age_weeks)) continue;
        
        // Check max age
        if (rule.max_age_weeks != null && (batchAgeWeeks == null || batchAgeWeeks > rule.max_age_weeks)) continue;
        
        // Check status match
        if (rule.match_status_ids?.length && !rule.match_status_ids.includes(batch.status_id)) continue;

        // All conditions passed - link this batch to the rule's product
        const linkKey = `${rule.product_id}:${batch.id}`;
        if (!existingSet.has(linkKey)) {
          linksToCreate.push({ product_id: rule.product_id, batch_id: batch.id });
          existingSet.add(linkKey);
          matchedBatchIds.add(batch.id);
        }
        
        // Only match first rule (highest priority)
        break;
      }
    }
  }

  // Second pass: SKU-based fallback for unmatched batches
  const unmatchedBatches = batches.filter((b: any) => !matchedBatchIds.has(b.id));

  if (unmatchedBatches.length > 0) {
    // Get all products with their SKU variety/size mappings
    const { data: products } = await supabase
      .from("products")
      .select(`
        id,
        sku_id,
        skus (
          plant_variety_id,
          size_id
        )
      `)
      .eq("org_id", orgId)
      .eq("is_active", true);

    if (products?.length) {
      // Build a map of variety+size to products
      const productMap = new Map<string, string>();
      for (const product of products) {
        const sku = product.skus;
        if (sku?.plant_variety_id && sku?.size_id) {
          const key = `${sku.plant_variety_id}:${sku.size_id}`;
          if (!productMap.has(key)) {
            productMap.set(key, product.id);
          }
        }
      }

      for (const batch of unmatchedBatches) {
        if (!batch.plant_variety_id || !batch.size_id) continue;

        const key = `${batch.plant_variety_id}:${batch.size_id}`;
        const productId = productMap.get(key);

        if (productId && !existingSet.has(`${productId}:${batch.id}`)) {
          linksToCreate.push({ product_id: productId, batch_id: batch.id });
          existingSet.add(`${productId}:${batch.id}`);
        }
      }
    }
  }

  if (linksToCreate.length > 0) {
    const { error: insertError } = await supabase
      .from("product_batches")
      .insert(linksToCreate);

    if (insertError) {
      console.warn("[autoLinkBatchesToProducts] Failed to create links:", insertError);
    } else {
      console.log(`[autoLinkBatchesToProducts] Created ${linksToCreate.length} product-batch links`);
    }
  }
}
