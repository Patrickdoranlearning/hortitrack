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
    revalidatePath("/dispatch/picking");
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
    revalidatePath("/dispatch/picking");
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
    revalidatePath("/dispatch/picking");
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
  loadName?: string
) {
  try {
    const runId = await createDeliveryRun({
      runDate: date,
      haulierId: haulierId === 'default' ? undefined : haulierId,
      vehicleId: vehicleId === 'default' ? undefined : vehicleId,
      loadName,
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
  updates: { loadName?: string; haulierId?: string; vehicleId?: string; runDate?: string }
) {
  try {
    const supabase = await createClient();
    
    const dbUpdates: Record<string, any> = {};
    if (updates.loadName !== undefined) dbUpdates.load_name = updates.loadName;
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
    const supabase = await createClient();
    
    // Check if any orders are assigned to this load
    const { data: items, error: checkError } = await supabase
      .from("delivery_items")
      .select("id")
      .eq("delivery_run_id", loadId)
      .limit(1);
      
    if (checkError) throw checkError;
    
    if (items && items.length > 0) {
      return { error: "Cannot delete load with assigned orders. Remove all orders first." };
    }
    
    // Delete the load
    const { error } = await supabase
      .from("delivery_runs")
      .delete()
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
 * Reorder loads by updating their display_order
 */
export async function reorderLoads(loadIds: string[]) {
  try {
    const supabase = await createClient();
    
    // Update display_order for each load
    const updates = loadIds.map((id, index) => 
      supabase
        .from("delivery_runs")
        .update({ display_order: index })
        .eq("id", id)
    );
    
    await Promise.all(updates);
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Remove an order from a load (unassign from delivery run)
 */
export async function removeOrderFromLoad(orderId: string) {
  try {
    const supabase = await createClient();
    
    // Delete the delivery item linking order to run
    const { error } = await supabase
      .from("delivery_items")
      .delete()
      .eq("order_id", orderId);
      
    if (error) throw error;
    
    // Reset order status back to confirmed if it was ready_for_dispatch
    await supabase
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", orderId)
      .eq("status", "ready_for_dispatch");
    
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
    revalidatePath("/dispatch/picking");
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

    // Assign each order to the route
    const results = await Promise.allSettled(
      orderIds.map(async (orderId) => {
        if (targetRouteId) {
          await addOrderToDeliveryRun({
            deliveryRunId: targetRouteId,
            orderId: orderId,
          });
        }
        // Keep status at ready_for_dispatch until the run goes in_transit
        await supabase
          .from("orders")
          .update({ status: "ready_for_dispatch" })
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
    const supabase = await createClient();
    
    // Get all orders in this load
    const { data: deliveryItems, error: fetchError } = await supabase
      .from("delivery_items")
      .select("order_id")
      .eq("delivery_run_id", loadId);
      
    if (fetchError) throw fetchError;
    
    if (!deliveryItems || deliveryItems.length === 0) {
      return { error: "No orders in this load to dispatch" };
    }
    
    const orderIds = deliveryItems.map(item => item.order_id);
    
    // Update delivery run status to in_transit
    const { error: runError } = await supabase
      .from("delivery_runs")
      .update({ 
        status: "in_transit",
        actual_departure_time: new Date().toISOString()
      })
      .eq("id", loadId);
      
    if (runError) throw runError;
    
    // Update all delivery items to in_transit
    const { error: itemsError } = await supabase
      .from("delivery_items")
      .update({ status: "in_transit" })
      .eq("delivery_run_id", loadId);
      
    if (itemsError) throw itemsError;
    
    // Update all orders to dispatched status
    const { error: ordersError } = await supabase
      .from("orders")
      .update({ status: "dispatched" })
      .in("id", orderIds);
      
    if (ordersError) throw ordersError;
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    
    return { success: true, ordersDispatched: orderIds.length };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Recall/Undispatch a load - reverses the dispatch action
 * Use this when a load was dispatched by mistake or the driver hasn't actually left
 */
export async function recallLoad(loadId: string) {
  try {
    const supabase = await createClient();
    
    // Get current load status
    const { data: load, error: loadError } = await supabase
      .from("delivery_runs")
      .select("status")
      .eq("id", loadId)
      .single();
      
    if (loadError) throw loadError;
    
    // Only allow recall from in_transit or loading status
    if (load.status === "completed") {
      return { error: "Cannot recall a completed load. Use reschedule instead." };
    }
    
    if (load.status === "cancelled") {
      return { error: "Cannot recall a cancelled load." };
    }
    
    // Get all orders in this load
    const { data: deliveryItems, error: fetchError } = await supabase
      .from("delivery_items")
      .select("order_id")
      .eq("delivery_run_id", loadId);
      
    if (fetchError) throw fetchError;
    
    const orderIds = deliveryItems?.map(item => item.order_id) || [];
    
    // Reset delivery run status back to planned
    const { error: runError } = await supabase
      .from("delivery_runs")
      .update({ 
        status: "planned",
        actual_departure_time: null 
      })
      .eq("id", loadId);
      
    if (runError) throw runError;
    
    // Reset delivery items to pending
    const { error: itemsError } = await supabase
      .from("delivery_items")
      .update({ status: "pending" })
      .eq("delivery_run_id", loadId);
      
    if (itemsError) throw itemsError;
    
    // Reset order status back to ready_for_dispatch (or confirmed if picking isn't done)
    if (orderIds.length > 0) {
      const { error: ordersError } = await supabase
        .from("orders")
        .update({ status: "ready_for_dispatch" })
        .in("id", orderIds);
        
      if (ordersError) throw ordersError;
    }
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    
    return { success: true, ordersRecalled: orderIds.length };
  } catch (error: any) {
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

