import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseAdmin } from "@/server/db/supabase";
import type {
  DetailedDistribution,
  OrderAllocationDetail,
  PlanAllocationDetail,
  SoldDetail,
  DumpedDetail,
  TransplantedDetail
} from "@/lib/history-types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;

    // Validate user is authenticated
    try {
      await getUserAndOrg();
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Authentication failed";
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get the batch basic info
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select("id, quantity, initial_quantity, reserved_quantity")
      .eq("id", batchId)
      .single();

    if (batchError) throw new Error(batchError.message);

    // Get sales allocations (allocated = reserved, picked = sold)
    // Allocation statuses: allocated, picked, short, damaged, replaced
    // Use left joins (no !inner) to handle orphaned allocations gracefully
    const { data: salesAllocations, error: salesAllocError } = await supabase
      .from("batch_allocations")
      .select(`
        id,
        quantity,
        status,
        created_at,
        updated_at,
        order_items(
          id,
          orders(
            id,
            order_number,
            requested_delivery_date,
            customers(name)
          )
        )
      `)
      .eq("batch_id", batchId)
      .in("status", ["allocated", "picked"]);

    if (salesAllocError) throw new Error(salesAllocError.message);

    // Get potting/production plan allocations
    // First get the batch's batch_plan_id, then get the plan details
    const { data: batchWithPlan } = await supabase
      .from("batches")
      .select("batch_plan_id")
      .eq("id", batchId)
      .single();

    let pottingPlans: any[] = [];
    if (batchWithPlan?.batch_plan_id) {
      const { data: pottingAllocations } = await supabase
        .from("batch_plans")
        .select(`
          id,
          planned_quantity,
          ready_from_week,
          ready_from_year,
          ready_to_week,
          ready_to_year,
          guide_plan_id,
          guide_plans(name)
        `)
        .eq("id", batchWithPlan.batch_plan_id)
        .neq("status", "completed");

      pottingPlans = pottingAllocations || [];
    }

    // Note: "picked" status items are included in salesAllocations above
    // We'll split them into allocated vs sold when building the details

    // Get sales events from batch_events (PICKED, SALE, DISPATCH)
    // These capture sales that might not have corresponding "picked" allocations
    const { data: salesEvents, error: salesEventsError } = await supabase
      .from("batch_events")
      .select("id, payload, at")
      .eq("batch_id", batchId)
      .in("type", ["PICKED", "SALE", "DISPATCH"]);

    if (salesEventsError) throw new Error(salesEventsError.message);

    // Get losses from batch_events - include both LOSS and DUMP types
    const { data: lossEvents, error: lossError } = await supabase
      .from("batch_events")
      .select("id, payload, at")
      .eq("batch_id", batchId)
      .in("type", ["LOSS", "DUMP"]);

    if (lossError) throw new Error(lossError.message);

    // Get transplant/move/consumed events (children) - includes transplants, partial moves, and actualized consumptions
    const { data: transplantEvents, error: transplantError } = await supabase
      .from("batch_events")
      .select("id, payload, at")
      .eq("batch_id", batchId)
      .in("type", ["TRANSPLANT_OUT", "TRANSPLANT_TO", "MOVE", "CONSUMED"]);

    if (transplantError) throw new Error(transplantError.message);

    // Get child batches for transplant details
    const { data: childBatches, error: childError } = await supabase
      .from("batches")
      .select("id, batch_number, created_at")
      .eq("parent_batch_id", batchId);

    if (childError) throw new Error(childError.message);

    // Build detailed distribution

    // Sales allocations - split by status: "allocated"/"reserved" = reserved, "picked" = sold
    // Filter out orphaned allocations where order_items is null
    const salesDetails: OrderAllocationDetail[] = (salesAllocations || [])
      .filter((a: any) => a.status === 'allocated' && a.order_items?.orders)
      .map((a: any) => ({
        id: a.id,
        quantity: a.quantity,
        date: a.created_at,
        orderId: a.order_items?.orders?.id,
        orderNumber: a.order_items?.orders?.order_number,
        customerName: a.order_items?.orders?.customers?.name || 'Unknown',
        deliveryDate: a.order_items?.orders?.requested_delivery_date,
        status: 'reserved' as const
      }));

    // Sold details - combine picked allocations AND sales events from batch_events
    // Track order_item_ids from allocations to avoid double-counting
    const pickedOrderItemIds = new Set<string>();
    
    // First, get sold details from picked allocations
    const soldFromAllocations: SoldDetail[] = (salesAllocations || [])
      .filter((a: any) => a.status === 'picked' && a.order_items?.orders)
      .map((a: any) => {
        const orderItemId = a.order_items?.id;
        if (orderItemId) pickedOrderItemIds.add(orderItemId);
        return {
          id: a.id,
          quantity: a.quantity,
          date: a.updated_at || a.created_at,
          orderId: a.order_items?.orders?.id,
          orderNumber: a.order_items?.orders?.order_number,
          customerName: a.order_items?.orders?.customers?.name || 'Unknown',
          soldDate: a.updated_at || a.created_at
        };
      });

    // Then, get sold details from batch_events (for historical/manual sales without allocations)
    const soldFromEvents: SoldDetail[] = (salesEvents || [])
      .map((evt: any) => {
        const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;
        const orderItemId = payload?.order_item_id;
        
        // Skip if already counted via allocation
        if (orderItemId && pickedOrderItemIds.has(orderItemId)) {
          return null;
        }
        
        const qty = Math.abs(payload?.units_picked || payload?.qty || payload?.quantity || 0);
        if (qty === 0) return null;
        
        return {
          id: evt.id,
          quantity: qty,
          date: evt.at,
          orderId: payload?.order_id || '',
          orderNumber: payload?.order_number || 'Unknown',
          customerName: payload?.customer_name || 'Unknown',
          soldDate: evt.at
        };
      })
      .filter((d: SoldDetail | null): d is SoldDetail => d !== null);

    // Combine both sources
    const soldDetails: SoldDetail[] = [...soldFromAllocations, ...soldFromEvents];

    // Potting allocations
    const pottingDetails: PlanAllocationDetail[] = pottingPlans.map((p: any) => {
      // Build target date from week/year if available
      const targetDate = p.ready_to_week && p.ready_to_year
        ? `W${p.ready_to_week} ${p.ready_to_year}`
        : '';
      return {
        id: p.id,
        quantity: p.planned_quantity || 0,
        date: targetDate,
        planId: p.guide_plan_id || p.id,
        planName: p.guide_plans?.name || 'Production Plan',
        targetDate
      };
    });

    // Dumped details (grouped by reason)
    const dumpedByReason: Record<string, { quantity: number; dates: string[] }> = {};
    for (const evt of lossEvents || []) {
      const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;
      const reason = payload?.reason || 'Unknown';
      // Support both legacy (units_dumped) and new (units) payload formats
      const qty = Math.abs(payload?.qty || payload?.quantity || payload?.units || payload?.units_dumped || 0);

      if (!dumpedByReason[reason]) {
        dumpedByReason[reason] = { quantity: 0, dates: [] };
      }
      dumpedByReason[reason].quantity += qty;
      dumpedByReason[reason].dates.push(evt.at);
    }

    const dumpedDetails: DumpedDetail[] = Object.entries(dumpedByReason).map(([reason, data]) => ({
      reason,
      quantity: data.quantity,
      dates: data.dates
    }));

    // Transplanted details - match child batches with transplant/move/consumed events
    const transplantedDetails: TransplantedDetail[] = (childBatches || []).map((child: any) => {
      // Find matching event to get quantity
      // TRANSPLANT_OUT uses to_batch_id, MOVE uses split_batch_id, CONSUMED uses consumedByBatch
      const matchingEvent = (transplantEvents || []).find((evt: any) => {
        const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;
        return payload?.to_batch_id === child.id || payload?.split_batch_id === child.id || payload?.consumedByBatch === child.id;
      });

      let quantity = 0;
      if (matchingEvent) {
        const payload = typeof matchingEvent.payload === 'string' ? JSON.parse(matchingEvent.payload) : matchingEvent.payload;
        quantity = payload?.consumedQuantity || payload?.units_moved || payload?.quantity || payload?.qty || 0;
      }

      return {
        id: child.id,
        quantity,
        date: child.created_at,
        childBatchId: child.id,
        childBatchNumber: child.batch_number
      };
    });

    // Calculate totals
    // Include ALL allocations (even orphaned ones) in totals for accurate distribution
    const allAllocatedQty = (salesAllocations || [])
      .filter((a: any) => a.status === 'allocated')
      .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);
    
    // Sold quantity from picked allocations (including orphaned ones)
    const soldFromAllocationsQty = (salesAllocations || [])
      .filter((a: any) => a.status === 'picked')
      .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);
    
    // Sold quantity from events (for entries not covered by allocations)
    const soldFromEventsQty = soldFromEvents.reduce((sum, d) => sum + d.quantity, 0);

    // Use reserved_quantity as fallback if no plan details exist
    const pottingFromPlans = pottingDetails.reduce((sum, p) => sum + p.quantity, 0);
    const allocatedPottingTotal = pottingFromPlans > 0
      ? pottingFromPlans
      : (batch?.reserved_quantity ?? 0);
    const allocatedSalesTotal = allAllocatedQty; // Use all allocations, not just ones with valid order data
    const soldTotal = soldFromAllocationsQty + soldFromEventsQty; // Combine both sources
    const dumpedTotal = dumpedDetails.reduce((sum, d) => sum + d.quantity, 0);
    const transplantedTotal = transplantedDetails.reduce((sum, t) => sum + t.quantity, 0);

    // Available = current quantity - allocations
    const currentQty = batch?.quantity || 0;
    const available = Math.max(0, currentQty - allocatedSalesTotal - allocatedPottingTotal);

    const totalAccounted = available + allocatedPottingTotal + allocatedSalesTotal + soldTotal + dumpedTotal + transplantedTotal;

    const distribution: DetailedDistribution = {
      available,
      allocatedPotting: {
        total: allocatedPottingTotal,
        details: pottingDetails
      },
      allocatedSales: {
        total: allocatedSalesTotal,
        details: salesDetails
      },
      sold: {
        total: soldTotal,
        details: soldDetails
      },
      dumped: {
        total: dumpedTotal,
        details: dumpedDetails
      },
      transplanted: {
        total: transplantedTotal,
        details: transplantedDetails
      },
      totalAccounted
    };

    return NextResponse.json(distribution);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = /Unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
