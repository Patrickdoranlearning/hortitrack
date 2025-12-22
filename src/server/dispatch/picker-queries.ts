import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUserAndOrg } from "@/server/auth/org";
import type { PickerTask } from "@/lib/dispatch/types";

/**
 * Get all picking tasks assigned to the current user
 */
export async function getPickerTasks(): Promise<PickerTask[]> {
  const { user, orgId, supabase } = await getUserAndOrg();

  // Fetch pick lists assigned to the current user
  const { data, error } = await supabase
    .from("pick_lists")
    .select(`
      id,
      org_id,
      order_id,
      assigned_user_id,
      assigned_team_id,
      sequence,
      status,
      qc_status,
      is_partial,
      merge_status,
      started_at,
      completed_at,
      notes,
      created_at,
      orders(
        order_number,
        status,
        requested_delivery_date,
        customers(name)
      )
    `)
    .eq("org_id", orgId)
    .eq("assigned_user_id", user.id)
    .in("status", ["pending", "in_progress"])
    .order("sequence", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching picker tasks:", error.message || JSON.stringify(error));
    throw new Error(error.message || "Failed to fetch picker tasks");
  }

  // Get item counts for each pick list
  const pickListIds = data.map((pl) => pl.id);

  const { data: itemCounts, error: itemError } = await supabase
    .from("pick_items")
    .select("pick_list_id, status, target_qty, picked_qty")
    .in("pick_list_id", pickListIds);

  if (itemError) {
    console.error("Error fetching item counts:", itemError);
  }

  // Get QC feedback counts
  const { data: feedbackCounts, error: feedbackError } = await supabase
    .from("qc_feedback")
    .select("pick_list_id, resolved_at, picker_acknowledged_at, picker_notified_at")
    .in("pick_list_id", pickListIds);

  if (feedbackError) {
    console.error("Error fetching feedback counts:", feedbackError);
  }

  // Aggregate counts by pick_list_id
  const itemCountsMap = new Map<string, {
    totalItems: number;
    pickedItems: number;
    totalQty: number;
    pickedQty: number;
  }>();

  for (const item of itemCounts || []) {
    const existing = itemCountsMap.get(item.pick_list_id) || {
      totalItems: 0,
      pickedItems: 0,
      totalQty: 0,
      pickedQty: 0,
    };
    existing.totalItems += 1;
    if (item.status === "picked" || item.status === "substituted") {
      existing.pickedItems += 1;
    }
    existing.totalQty += item.target_qty || 0;
    existing.pickedQty += item.picked_qty || 0;
    itemCountsMap.set(item.pick_list_id, existing);
  }

  const feedbackCountsMap = new Map<string, {
    pendingFeedbackCount: number;
    unacknowledgedFeedbackCount: number;
  }>();

  for (const feedback of feedbackCounts || []) {
    const existing = feedbackCountsMap.get(feedback.pick_list_id) || {
      pendingFeedbackCount: 0,
      unacknowledgedFeedbackCount: 0,
    };
    if (!feedback.resolved_at) {
      existing.pendingFeedbackCount += 1;
    }
    if (!feedback.picker_acknowledged_at && feedback.picker_notified_at) {
      existing.unacknowledgedFeedbackCount += 1;
    }
    feedbackCountsMap.set(feedback.pick_list_id, existing);
  }

  // Map to PickerTask format
  return data
    .filter((pl) => pl.orders) // Filter out pick lists with no order (shouldn't happen but handle gracefully)
    .map((pl): PickerTask => {
      const order = pl.orders as any;
      const customer = order?.customers as any;
      const counts = itemCountsMap.get(pl.id) || {
        totalItems: 0,
        pickedItems: 0,
        totalQty: 0,
        pickedQty: 0,
      };
      const feedback = feedbackCountsMap.get(pl.id) || {
        pendingFeedbackCount: 0,
        unacknowledgedFeedbackCount: 0,
      };

      return {
        id: pl.id,
        orgId: pl.org_id,
        orderId: pl.order_id,
        assignedUserId: pl.assigned_user_id || undefined,
        assignedTeamId: pl.assigned_team_id || undefined,
        sequence: pl.sequence,
        status: pl.status,
        qcStatus: pl.qc_status || undefined,
        isPartial: pl.is_partial ?? false,
        mergeStatus: pl.merge_status || undefined,
        startedAt: pl.started_at || undefined,
        completedAt: pl.completed_at || undefined,
        notes: pl.notes || undefined,
        createdAt: pl.created_at,
        orderNumber: order?.order_number || "Unknown",
        orderStatus: order?.status || "unknown",
        requestedDeliveryDate: order?.requested_delivery_date || undefined,
        customerName: customer?.name || "Unknown Customer",
        ...counts,
        ...feedback,
      };
    });
}

/**
 * Get tasks assigned to the current user's team (for team-based picking)
 */
export async function getTeamPickerTasks(): Promise<PickerTask[]> {
  const { user, orgId, supabase } = await getUserAndOrg();

  // First, get the user's team memberships
  const { data: memberships, error: membershipError } = await supabase
    .from("picking_team_members")
    .select("team_id")
    .eq("user_id", user.id);

  if (membershipError) {
    console.error("Error fetching team memberships:", membershipError);
    return [];
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const teamIds = memberships.map((m) => m.team_id);

  // Fetch pick lists assigned to these teams (but not specifically to another user)
  const { data, error } = await supabase
    .from("pick_lists")
    .select(`
      id,
      org_id,
      order_id,
      assigned_user_id,
      assigned_team_id,
      sequence,
      status,
      qc_status,
      is_partial,
      merge_status,
      started_at,
      completed_at,
      notes,
      created_at,
      orders(
        order_number,
        status,
        requested_delivery_date,
        customers(name)
      )
    `)
    .eq("org_id", orgId)
    .in("assigned_team_id", teamIds)
    .is("assigned_user_id", null) // Only unassigned to individual
    .in("status", ["pending", "in_progress"])
    .order("sequence", { ascending: true });

  if (error) {
    console.error("Error fetching team picker tasks:", error.message || JSON.stringify(error));
    throw new Error(error.message || "Failed to fetch team picker tasks");
  }

  // Similar aggregation as above
  const pickListIds = data.map((pl) => pl.id);

  const { data: itemCounts } = await supabase
    .from("pick_items")
    .select("pick_list_id, status, target_qty, picked_qty")
    .in("pick_list_id", pickListIds);

  const itemCountsMap = new Map<string, {
    totalItems: number;
    pickedItems: number;
    totalQty: number;
    pickedQty: number;
  }>();

  for (const item of itemCounts || []) {
    const existing = itemCountsMap.get(item.pick_list_id) || {
      totalItems: 0,
      pickedItems: 0,
      totalQty: 0,
      pickedQty: 0,
    };
    existing.totalItems += 1;
    if (item.status === "picked" || item.status === "substituted") {
      existing.pickedItems += 1;
    }
    existing.totalQty += item.target_qty || 0;
    existing.pickedQty += item.picked_qty || 0;
    itemCountsMap.set(item.pick_list_id, existing);
  }

  return data
    .filter((pl) => pl.orders) // Filter out pick lists with no order
    .map((pl): PickerTask => {
      const order = pl.orders as any;
      const customer = order?.customers as any;
      const counts = itemCountsMap.get(pl.id) || {
        totalItems: 0,
        pickedItems: 0,
        totalQty: 0,
        pickedQty: 0,
      };

      return {
        id: pl.id,
        orgId: pl.org_id,
        orderId: pl.order_id,
        assignedUserId: pl.assigned_user_id || undefined,
        assignedTeamId: pl.assigned_team_id || undefined,
        sequence: pl.sequence,
        status: pl.status,
        qcStatus: pl.qc_status || undefined,
        isPartial: pl.is_partial ?? false,
        mergeStatus: pl.merge_status || undefined,
        startedAt: pl.started_at || undefined,
        completedAt: pl.completed_at || undefined,
        notes: pl.notes || undefined,
        createdAt: pl.created_at,
        orderNumber: order?.order_number || "Unknown",
        orderStatus: order?.status || "unknown",
        requestedDeliveryDate: order?.requested_delivery_date || undefined,
        customerName: customer?.name || "Unknown Customer",
        ...counts,
        pendingFeedbackCount: 0,
        unacknowledgedFeedbackCount: 0,
      };
    });
}

/**
 * Get combined picker tasks (personal + team)
 */
export async function getAllPickerTasks(): Promise<{
  myTasks: PickerTask[];
  teamTasks: PickerTask[];
}> {
  const [myTasks, teamTasks] = await Promise.all([
    getPickerTasks(),
    getTeamPickerTasks(),
  ]);

  return { myTasks, teamTasks };
}
