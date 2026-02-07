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
import { getUserAndOrg } from "@/server/auth/org";
import { supabaseAdmin } from "@/server/db/supabaseAdmin";
import { logger, getErrorMessage } from "@/server/utils/logger";
import { canTransition, type OrderStatus } from "@/server/sales/status";
import type { DeliveryRunUpdate } from "@/lib/dispatch/db-types";

export async function assignOrderToTeam(orderId: string, teamId: string | null) {
  try {
    // Auth check - getUserAndOrg throws if not authenticated
    await getUserAndOrg();

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
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/**
 * Assign an individual picker (grower) to an order
 * Note: Requires the assigned_user_id column on pick_lists (migration: 20251210100000)
 */
export async function assignOrderToPicker(orderId: string, pickerId: string | null) {
  try {
    const { orgId, supabase } = await getUserAndOrg();
    const pickList = await getPickListForOrder(orderId);

    if (!pickList) {
      // Create pick list first if it doesn't exist
      const result = await createPickListFromOrder(orderId);
      if (result.error) throw new Error(result.error);

      // Now update with the picker (column may not exist yet)
      if (result.pickList?.id && pickerId) {
        const { error } = await supabase
          .from("pick_lists")
          .update({ assigned_user_id: pickerId } as any)
          .eq("id", result.pickList.id)
          .eq("org_id", orgId);

        if (error) {
          // If column doesn't exist, log warning but don't fail
          if (error.code === "42703") {
            logger.dispatch.warn("assigned_user_id column not found. Run migration 20251210100000_add_assigned_user_to_pick_lists.sql");
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
        .eq("id", pickList.id)
        .eq("org_id", orgId);

      if (error) {
        // If column doesn't exist, log warning but don't fail
        if (error.code === "42703") {
          logger.dispatch.warn("assigned_user_id column not found. Run migration 20251210100000_add_assigned_user_to_pick_lists.sql");
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
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function assignOrderToRun(orderId: string, runId: string) {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    // Check for existing active delivery item
    const { data: existingItem } = await supabase
      .from("delivery_items")
      .select("id")
      .eq("order_id", orderId)
      .eq("org_id", orgId)
      .in("status", ["pending", "loading", "in_transit"]) // Active statuses
      .maybeSingle(); // Use maybeSingle to avoid error if multiple (though shouldn't accept multiple active)

    if (existingItem) {
        // Update existing
        const { error } = await supabase
            .from("delivery_items")
            .update({ delivery_run_id: runId })
            .eq("id", existingItem.id)
            .eq("org_id", orgId);

        if (error) throw error;
    } else {
        // Add new (addOrderToDeliveryRun already handles org_id internally)
        await addOrderToDeliveryRun({
            deliveryRunId: runId,
            orderId: orderId,
            trolleysDelivered: 0,
        });
    }

    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/picker");
    revalidatePath("/dispatch/driver");
    return { success: true };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function createRunAndAssign(orderId: string, haulierId: string, date: string) {
  try {
    // Auth check - createDeliveryRun handles org_id internally via getUserAndOrg
    await getUserAndOrg();

    // Create run (haulierId might be 'default' if no hauliers exist)
    // Status defaults to 'planned' in the database
    const runId = await createDeliveryRun({
      runDate: date,
      haulierId: haulierId === 'default' ? undefined : haulierId,
    });
    
    // Assign order if provided
    if (orderId) {
      await assignOrderToRun(orderId, runId);
    }
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    return { success: true, runId };
  } catch (error) {
    return { error: getErrorMessage(error) };
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
    // Auth check - createDeliveryRun handles org_id internally via getUserAndOrg
    await getUserAndOrg();

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
  } catch (error) {
    return { error: getErrorMessage(error) };
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
    // Auth check - createDeliveryRun handles org_id internally via getUserAndOrg
    await getUserAndOrg();

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
  } catch (error) {
    return { error: getErrorMessage(error) };
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
    const { orgId, supabase } = await getUserAndOrg();

    const dbUpdates: DeliveryRunUpdate = {};
    if (updates.loadCode !== undefined) dbUpdates.load_name = updates.loadCode;
    if (updates.haulierId !== undefined) dbUpdates.haulier_id = updates.haulierId || null;
    if (updates.vehicleId !== undefined) dbUpdates.vehicle_id = updates.vehicleId || null;
    if (updates.runDate !== undefined) dbUpdates.run_date = updates.runDate;

    const { error } = await supabase
      .from("delivery_runs")
      .update(dbUpdates)
      .eq("id", loadId)
      .eq("org_id", orgId);
      
    if (error) throw error;
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    return { success: true };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/**
 * Delete a delivery load - only allowed if no orders are assigned
 */
export async function deleteLoad(loadId: string) {
  try {
    const { orgId } = await getUserAndOrg();
    logger.dispatch.info("Attempting to delete load", { loadId, orgId });

    // Use admin client to bypass any RLS issues, but scope by org_id
    // Check if any orders are assigned to this load
    const { data: items, error: checkError } = await supabaseAdmin
      .from("delivery_items")
      .select("id")
      .eq("delivery_run_id", loadId)
      .eq("org_id", orgId)
      .limit(1);

    if (checkError) {
      logger.dispatch.error("Error checking items for load", checkError, { loadId });
      throw checkError;
    }

    logger.dispatch.info("Found items in load", { loadId, itemCount: items?.length ?? 0 });

    if (items && items.length > 0) {
      return { error: "Cannot delete load with assigned orders. Remove all orders first." };
    }

    // Delete the load using admin client, scoped by org_id
    const { error } = await supabaseAdmin
      .from("delivery_runs")
      .delete()
      .eq("id", loadId)
      .eq("org_id", orgId);

    if (error) {
      logger.dispatch.error("Error deleting load", error, { loadId });
      throw error;
    }

    logger.dispatch.info("Load deleted successfully", { loadId });

    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    return { success: true };
  } catch (error) {
    logger.dispatch.error("Error in deleteLoad", error, { loadId });
    return { error: getErrorMessage(error) };
  }
}

/**
 * Reorder loads by updating their display_order
 */
export async function reorderLoads(loadIds: string[]) {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    // Update display_order for each load, scoped by org_id
    const results = await Promise.all(
      loadIds.map((id, index) =>
        supabase
          .from("delivery_runs")
          .update({ display_order: index })
          .eq("id", id)
          .eq("org_id", orgId)
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
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/**
 * Remove an order from a load (unassign from delivery run)
 * Only removes active delivery items, preserves historical records
 */
export async function removeOrderFromLoad(orderId: string) {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    // Delete only ACTIVE delivery items (not historical/completed ones)
    const { error } = await supabase
      .from("delivery_items")
      .delete()
      .eq("order_id", orderId)
      .eq("org_id", orgId)
      .in("status", ["pending", "loading", "in_transit"]);

    if (error) throw error;

    // Check current order status before transitioning back to confirmed
    const { data: order } = await supabase
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .eq("org_id", orgId)
      .single();

    if (order && canTransition(order.status as OrderStatus, "confirmed")) {
      await supabase
        .from("orders")
        .update({ status: "confirmed" })
        .eq("id", orderId)
        .eq("org_id", orgId);
    }
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");
    return { success: true };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function updateOrderDate(orderId: string, date: string) {
  try {
    const { orgId, supabase } = await getUserAndOrg();
    const { error } = await supabase
      .from("orders")
      .update({ requested_delivery_date: date })
      .eq("id", orderId)
      .eq("org_id", orgId);
      
    if (error) throw error;
    
    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/picker");
    revalidatePath("/dispatch/driver");
    return { success: true };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/**
 * Bulk dispatch orders - assigns them to a route and marks as dispatched
 * If no routeId provided, creates a new route for today
 */
export async function dispatchOrders(orderIds: string[], routeId?: string, haulierId?: string) {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    if (orderIds.length === 0) {
      return { error: "No orders provided" };
    }

    let targetRouteId = routeId;

    // If no route specified, create a new one
    if (!targetRouteId) {
      if (!haulierId) {
        // Get default haulier or first available, scoped by org_id
        const { data: hauliers } = await supabase
          .from("hauliers")
          .select("id")
          .eq("org_id", orgId)
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

    // Assign each order to the route, with status transition check
    const results = await Promise.allSettled(
      orderIds.map(async (orderId) => {
        await addOrderToDeliveryRun({
          deliveryRunId: targetRouteId,
          orderId: orderId,
          trolleysDelivered: 0,
        });
        // Check current status before transitioning to packed
        const { data: order } = await supabase
          .from("orders")
          .select("status")
          .eq("id", orderId)
          .eq("org_id", orgId)
          .single();

        if (order && canTransition(order.status as OrderStatus, "packed")) {
          await supabase
            .from("orders")
            .update({ status: "packed" })
            .eq("id", orderId)
            .eq("org_id", orgId);
        }
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
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/**
 * Dispatch an entire load - marks the delivery run as in_transit
 * and updates all orders to dispatched status
 *
 * Uses atomic database function to ensure all updates happen in a single transaction.
 * If any step fails, all changes are rolled back to prevent partial state.
 */
export async function dispatchLoad(loadId: string) {
  try {
    const { orgId } = await getUserAndOrg();
    logger.dispatch.info("Dispatching load", { loadId, orgId });

    // Verify the load belongs to this org before dispatching
    const { data: loadCheck, error: loadCheckError } = await supabaseAdmin
      .from("delivery_runs")
      .select("id")
      .eq("id", loadId)
      .eq("org_id", orgId)
      .single();

    if (loadCheckError || !loadCheck) {
      return { error: "Load not found or access denied" };
    }

    // Use atomic RPC function - handles all updates in single transaction
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "dispatch_load",
      { p_load_id: loadId }
    );

    if (rpcError) {
      logger.dispatch.error("RPC error dispatching load", rpcError, { loadId });
      return { error: rpcError.message || "Failed to dispatch load" };
    }

    if (!result?.success) {
      logger.dispatch.warn("Dispatch validation failed", { loadId, error: result?.error });
      return { error: result?.error || "Failed to dispatch load" };
    }

    logger.dispatch.info("Successfully dispatched load", { loadId, ordersDispatched: result.ordersDispatched });

    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");

    return { success: true, ordersDispatched: result.ordersDispatched };
  } catch (error) {
    logger.dispatch.error("Error in dispatchLoad", error, { loadId });
    return { error: getErrorMessage(error) };
  }
}

/**
 * Recall/Undispatch a load - reverses the dispatch action
 * Use this when a load was dispatched by mistake or the driver hasn't actually left
 *
 * Uses atomic database function to ensure all updates happen in a single transaction.
 * If any step fails, all changes are rolled back to prevent partial state.
 */
export async function recallLoad(loadId: string) {
  try {
    const { orgId } = await getUserAndOrg();
    logger.dispatch.info("Recalling load", { loadId, orgId });

    // Verify the load belongs to this org before recalling
    const { data: loadCheck, error: loadCheckError } = await supabaseAdmin
      .from("delivery_runs")
      .select("id")
      .eq("id", loadId)
      .eq("org_id", orgId)
      .single();

    if (loadCheckError || !loadCheck) {
      return { error: "Load not found or access denied" };
    }

    // Use atomic RPC function - handles all updates in single transaction
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "recall_load",
      { p_load_id: loadId }
    );

    if (rpcError) {
      logger.dispatch.error("RPC error recalling load", rpcError, { loadId });
      return { error: rpcError.message || "Failed to recall load" };
    }

    if (!result?.success) {
      logger.dispatch.warn("Recall validation failed", { loadId, error: result?.error });
      return { error: result?.error || "Failed to recall load" };
    }

    logger.dispatch.info("Successfully recalled load", { loadId, ordersRecalled: result.ordersRecalled });

    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");

    return { success: true, ordersRecalled: result.ordersRecalled };
  } catch (error) {
    logger.dispatch.error("Error in recallLoad", error, { loadId });
    return { error: getErrorMessage(error) };
  }
}

/**
 * Update the status of a delivery run
 */
export async function updateLoadStatus(loadId: string, status: 'planned' | 'loading' | 'in_transit' | 'completed' | 'cancelled') {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const dbUpdates: DeliveryRunUpdate = { status };

    // Set timestamps based on status changes
    if (status === 'in_transit') {
      dbUpdates.actual_departure_time = new Date().toISOString();
    } else if (status === 'completed') {
      dbUpdates.actual_return_time = new Date().toISOString();
    } else if (status === 'planned') {
      dbUpdates.actual_departure_time = null;
      dbUpdates.actual_return_time = null;
    }

    const { error } = await supabase
      .from("delivery_runs")
      .update(dbUpdates)
      .eq("id", loadId)
      .eq("org_id", orgId);

    if (error) throw error;

    revalidatePath("/dispatch");
    revalidatePath("/dispatch/deliveries");
    revalidatePath("/dispatch/driver");

    return { success: true };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
