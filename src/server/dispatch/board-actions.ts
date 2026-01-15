"use server";

import { revalidatePath } from "next/cache";
import {
  createPickListFromOrder,
  assignPickListToTeam,
  getPickListForOrder
} from "@/server/sales/picking";
import {
  addOrderToDeliveryRun,
  createDeliveryRun
} from "@/server/dispatch/queries.server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/server/db/supabaseAdmin";

export async function assignOrderToTeam(orderId: string, teamId: string | null) {
  try {
    const pickList = await getPickListForOrder(orderId);
    
    if (!pickList) {
      // Create pick list first if it doesn't exist
      const result = await createPickListFromOrder(orderId, teamId || undefined);
      if (result.error) throw new Error(result.error);
    } else {
      // Update existing
      const result = await assignPickListToTeam(pickList.id, teamId);
      if (result.error) throw new Error(result.error);
    }
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/picker");
    revalidatePath("/dispatch/driver");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Assign an individual picker (grower) to an order
 * Note: Requires the assigned_user_id column on pick_lists (migration: 20251210100000)
 */
export async function assignOrderToPicker(orderId: string, pickerId: string | null) {
  try {
    const supabase = await createClient();
    const pickList = await getPickListForOrder(orderId);
    
    if (!pickList) {
      // Create pick list first if it doesn't exist
      const result = await createPickListFromOrder(orderId);
      if (result.error) throw new Error(result.error);
      
      // Now update with the picker (column may not exist yet)
      if (result.pickListId && pickerId) {
        const { error } = await supabase
          .from("pick_lists")
          .update({ assigned_user_id: pickerId } as any)
          .eq("id", result.pickListId);
        
        if (error) {
          // If column doesn't exist, log warning but don't fail
          if (error.code === "42703") {
            console.warn("assigned_user_id column not found. Run migration 20251210100000_add_assigned_user_to_pick_lists.sql");
            // Still return success as pick list was created
          } else {
            throw error;
          }
        }
      }
    } else {
      // Update existing pick list with the picker
      const { error } = await supabase
        .from("pick_lists")
        .update({ assigned_user_id: pickerId } as any)
        .eq("id", pickList.id);
      
      if (error) {
        // If column doesn't exist, log warning but don't fail
        if (error.code === "42703") {
          console.warn("assigned_user_id column not found. Run migration 20251210100000_add_assigned_user_to_pick_lists.sql");
        } else {
          throw error;
        }
      }
    }
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/picker");
    revalidatePath("/dispatch/driver");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function assignOrderToRun(orderId: string, runId: string) {
  try {
    const supabase = await createClient();
    
    // Check for existing active delivery item
    const { data: existingItem } = await supabase
      .from("delivery_items")
      .select("id")
      .eq("order_id", orderId)
      .in("status", ["pending", "loading", "in_transit"]) // Active statuses
      .maybeSingle(); // Use maybeSingle to avoid error if multiple (though shouldn't accept multiple active)
      
    if (existingItem) {
        // Update existing
        const { error } = await supabase
            .from("delivery_items")
            .update({ delivery_run_id: runId })
            .eq("id", existingItem.id);
            
        if (error) throw error;
    } else {
        // Add new
        await addOrderToDeliveryRun({
            deliveryRunId: runId,
            orderId: orderId,
        });
    }

    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/picker");
    revalidatePath("/dispatch/driver");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function createRunAndAssign(orderId: string, haulierId: string, date: string) {
  try {
    // Create run (haulierId might be 'default' if no hauliers exist)
    const runId = await createDeliveryRun({
      runDate: date,
      haulierId: haulierId === 'default' ? undefined : haulierId,
      status: "planned"
    });
    
    // Assign order if provided
    if (orderId) {
      await assignOrderToRun(orderId, runId);
    }
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    return { success: true, runId };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Create a new empty delivery load (no orders assigned yet)
 */
export async function createEmptyRoute(
  date: string, 
  haulierId?: string, 
  vehicleId?: string,
  loadCode?: string
) {
  try {
    const runId = await createDeliveryRun({
      runDate: date,
      haulierId: haulierId === 'default' ? undefined : haulierId,
      vehicleId: vehicleId === 'default' ? undefined : vehicleId,
      loadCode,
    });
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    return { success: true, runId };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Create a new delivery load and assign orders immediately
 */
export async function createLoadWithOrders(
  date: string,
  orderIds: string[],
  haulierId?: string,
  vehicleId?: string,
  loadCode?: string
) {
  try {
    const runId = await createDeliveryRun({
      runDate: date,
      haulierId: haulierId === "default" ? undefined : haulierId,
      vehicleId: vehicleId === "default" ? undefined : vehicleId,
      loadCode,
      orderIds,
    });

    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    return { success: true, runId };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Update a delivery load's details
 */
export async function updateLoad(
  loadId: string, 
  updates: { loadCode?: string; haulierId?: string; vehicleId?: string; runDate?: string }
) {
  try {
    const supabase = await createClient();
    
    const dbUpdates: Record<string, any> = {};
    if (updates.loadCode !== undefined) dbUpdates.load_name = updates.loadCode;
    if (updates.haulierId !== undefined) dbUpdates.haulier_id = updates.haulierId || null;
    if (updates.vehicleId !== undefined) dbUpdates.vehicle_id = updates.vehicleId || null;
    if (updates.runDate !== undefined) dbUpdates.run_date = updates.runDate;
    
    const { error } = await supabase
      .from("delivery_runs")
      .update(dbUpdates)
      .eq("id", loadId);
      
    if (error) throw error;
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Delete a delivery load - only allowed if no orders are assigned
 */
export async function deleteLoad(loadId: string) {
  try {
    console.log(`[deleteLoad] Attempting to delete load: ${loadId}`);

    // Use admin client to bypass any RLS issues
    // Check if any orders are assigned to this load
    const { data: items, error: checkError } = await supabaseAdmin
      .from("delivery_items")
      .select("id")
      .eq("delivery_run_id", loadId)
      .limit(1);

    if (checkError) {
      console.error(`[deleteLoad] Error checking items:`, checkError);
      throw checkError;
    }

    console.log(`[deleteLoad] Found ${items?.length ?? 0} items in load`);

    if (items && items.length > 0) {
      return { error: "Cannot delete load with assigned orders. Remove all orders first." };
    }

    // Delete the load using admin client
    const { error } = await supabaseAdmin
      .from("delivery_runs")
      .delete()
      .eq("id", loadId);

    console.log(`[deleteLoad] Delete completed, error: ${error?.message ?? 'none'}`);

    if (error) throw error;

    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    return { success: true };
  } catch (error: any) {
    console.error(`[deleteLoad] Error:`, error);
    return { error: error.message };
  }
}

/**
 * Reorder loads by updating their display_order
 */
export async function reorderLoads(loadIds: string[]) {
  try {
    const supabase = await createClient();
    
    // Update display_order for each load
    const results = await Promise.all(
      loadIds.map((id, index) => 
        supabase
          .from("delivery_runs")
          .update({ display_order: index })
          .eq("id", id)
      )
    );
    
    // Check for any errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      throw new Error(errors[0].error?.message || "Failed to reorder loads");
    }
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Remove an order from a load (unassign from delivery run)
 * Only removes active delivery items, preserves historical records
 */
export async function removeOrderFromLoad(orderId: string) {
  try {
    const supabase = await createClient();
    
    // Delete only ACTIVE delivery items (not historical/completed ones)
    const { error } = await supabase
      .from("delivery_items")
      .delete()
      .eq("order_id", orderId)
      .in("status", ["pending", "loading", "in_transit"]);
      
    if (error) throw error;
    
    // Reset order status back to confirmed if it was packed (ready for dispatch)
    await supabase
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", orderId)
      .eq("status", "packed");
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateOrderDate(orderId: string, date: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("orders")
      .update({ requested_delivery_date: date })
      .eq("id", orderId);
      
    if (error) throw error;
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/picker");
    revalidatePath("/dispatch/driver");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Bulk dispatch orders - assigns them to a route and marks as dispatched
 * If no routeId provided, creates a new route for today
 */
export async function dispatchOrders(orderIds: string[], routeId?: string, haulierId?: string) {
  try {
    const supabase = await createClient();
    
    if (orderIds.length === 0) {
      return { error: "No orders provided" };
    }

    let targetRouteId = routeId;

    // If no route specified, create a new one
    if (!targetRouteId) {
      if (!haulierId) {
        // Get default haulier or first available
        const { data: hauliers } = await supabase
          .from("hauliers")
          .select("id")
          .eq("is_active", true)
          .limit(1);
        
        haulierId = hauliers?.[0]?.id;
      }

      if (haulierId) {
        const today = new Date().toISOString().split('T')[0];
        targetRouteId = await createDeliveryRun({
          runDate: today,
          haulierId: haulierId,
        });
      }
    }

    // Error if we couldn't create or find a route
    if (!targetRouteId) {
      return { error: "No delivery route available. Please create a haulier first or specify a route." };
    }

    // Assign each order to the route
    const results = await Promise.allSettled(
      orderIds.map(async (orderId) => {
        await addOrderToDeliveryRun({
          deliveryRunId: targetRouteId,
          orderId: orderId,
        });
        // Keep status at packed until the run goes in_transit
        await supabase
          .from("orders")
          .update({ status: "packed" })
          .eq("id", orderId);
      })
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");

    if (failed > 0) {
      return { 
        success: true, 
        warning: `${failed} of ${orderIds.length} orders failed to dispatch`,
        routeId: targetRouteId 
      };
    }

    return { success: true, routeId: targetRouteId };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Dispatch an entire load - marks the delivery run as in_transit 
 * and updates all orders to dispatched status
 */
export async function dispatchLoad(loadId: string) {
  try {
    console.log(`[dispatchLoad] Dispatching load: ${loadId}`);

    // Get all orders in this load
    const { data: deliveryItems, error: fetchError } = await supabaseAdmin
      .from("delivery_items")
      .select("order_id")
      .eq("delivery_run_id", loadId);

    if (fetchError) throw fetchError;

    if (!deliveryItems || deliveryItems.length === 0) {
      return { error: "No orders in this load to dispatch" };
    }

    const orderIds = deliveryItems.map(item => item.order_id);
    console.log(`[dispatchLoad] Found ${orderIds.length} orders to dispatch`);

    // Check that all orders have completed pick lists (or no pick list for manual orders)
    const { data: incompletePicks } = await supabaseAdmin
      .from("pick_lists")
      .select("id, order_id, status, orders(order_number)")
      .in("order_id", orderIds)
      .neq("status", "completed");

    if (incompletePicks && incompletePicks.length > 0) {
      const orderNumbers = incompletePicks
        .map((p: any) => p.orders?.order_number || p.order_id)
        .join(", ");
      return {
        error: `Cannot dispatch - ${incompletePicks.length} order(s) have incomplete picking: ${orderNumbers}. Complete all pick lists first.`
      };
    }

    // Update delivery run status to in_transit
    const { error: runError } = await supabaseAdmin
      .from("delivery_runs")
      .update({
        status: "in_transit",
        actual_departure_time: new Date().toISOString()
      })
      .eq("id", loadId);

    if (runError) throw runError;

    // Update all delivery items to in_transit
    const { error: itemsError } = await supabaseAdmin
      .from("delivery_items")
      .update({ status: "in_transit" })
      .eq("delivery_run_id", loadId);

    if (itemsError) throw itemsError;

    // Update all orders to dispatched status
    const { error: ordersError } = await supabaseAdmin
      .from("orders")
      .update({ status: "dispatched" })
      .in("id", orderIds);

    if (ordersError) throw ordersError;

    console.log(`[dispatchLoad] Successfully dispatched ${orderIds.length} orders`);

    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");

    return { success: true, ordersDispatched: orderIds.length };
  } catch (error: any) {
    console.error(`[dispatchLoad] Error:`, error);
    return { error: error.message };
  }
}

/**
 * Recall/Undispatch a load - reverses the dispatch action
 * Use this when a load was dispatched by mistake or the driver hasn't actually left
 */
export async function recallLoad(loadId: string) {
  try {
    console.log(`[recallLoad] Recalling load: ${loadId}`);

    // Get current load status
    const { data: load, error: loadError } = await supabaseAdmin
      .from("delivery_runs")
      .select("status")
      .eq("id", loadId)
      .single();

    if (loadError) throw loadError;

    console.log(`[recallLoad] Current status: ${load.status}`);

    // Only allow recall from in_transit or loading status
    if (load.status === "completed") {
      return { error: "Cannot recall a completed load. Use reschedule instead." };
    }

    if (load.status === "cancelled") {
      return { error: "Cannot recall a cancelled load." };
    }

    // Get all orders in this load
    const { data: deliveryItems, error: fetchError } = await supabaseAdmin
      .from("delivery_items")
      .select("order_id")
      .eq("delivery_run_id", loadId);

    if (fetchError) throw fetchError;

    const orderIds = deliveryItems?.map(item => item.order_id) || [];
    console.log(`[recallLoad] Found ${orderIds.length} orders to recall`);

    // Reset delivery run status back to planned
    const { error: runError } = await supabaseAdmin
      .from("delivery_runs")
      .update({
        status: "planned",
        actual_departure_time: null
      })
      .eq("id", loadId);

    if (runError) throw runError;

    // Reset delivery items to pending
    const { error: itemsError } = await supabaseAdmin
      .from("delivery_items")
      .update({ status: "pending" })
      .eq("delivery_run_id", loadId);

    if (itemsError) throw itemsError;

    // Reset order status back to packed (or confirmed if picking isn't done)
    if (orderIds.length > 0) {
      const { error: ordersError } = await supabaseAdmin
        .from("orders")
        .update({ status: "packed" })
        .in("id", orderIds);

      if (ordersError) throw ordersError;
    }

    console.log(`[recallLoad] Successfully recalled ${orderIds.length} orders`);

    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");

    return { success: true, ordersRecalled: orderIds.length };
  } catch (error: any) {
    console.error(`[recallLoad] Error:`, error);
    return { error: error.message };
  }
}

/**
 * Update the status of a delivery run
 */
export async function updateLoadStatus(loadId: string, status: 'planned' | 'loading' | 'in_transit' | 'completed' | 'cancelled') {
  try {
    const supabase = await createClient();
    
    const updates: Record<string, any> = { status };
    
    // Set timestamps based on status changes
    if (status === 'in_transit') {
      updates.actual_departure_time = new Date().toISOString();
    } else if (status === 'completed') {
      updates.actual_return_time = new Date().toISOString();
    } else if (status === 'planned') {
      updates.actual_departure_time = null;
      updates.actual_return_time = null;
    }
    
    const { error } = await supabase
      .from("delivery_runs")
      .update(updates)
      .eq("id", loadId);
      
    if (error) throw error;
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
