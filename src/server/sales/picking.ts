// src/server/sales/picking.ts
import "server-only";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import { generateInvoice } from "@/app/sales/actions";
import {
  createTask,
  updateTask,
  deleteTaskBySourceRef,
  getTaskBySourceRef,
} from "@/server/tasks/service";

// Helper to extract name from Supabase joined data (may be array or object)
function extractName(joined: unknown): string | undefined {
  if (!joined) return undefined;
  if (Array.isArray(joined)) return (joined[0] as { name?: string })?.name;
  return (joined as { name?: string })?.name;
}

// ================================================
// TYPES
// ================================================

export type PickListStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type PickItemStatus = "pending" | "picked" | "short" | "substituted" | "skipped";

export interface PickingTeam {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  memberCount?: number;
}

export interface PickingTeamMember {
  id: string;
  teamId: string;
  userId: string;
  isLead: boolean;
  displayName?: string;
  email?: string;
}

export interface PickList {
  id: string;
  orgId: string;
  orderId: string;
  assignedTeamId?: string;
  assignedUserId?: string;
  sequence: number;
  status: PickListStatus;
  startedAt?: string;
  completedAt?: string;
  startedBy?: string;
  completedBy?: string;
  notes?: string;
  createdAt: string;
  // Joined fields
  orderNumber?: string;
  orderStatus?: string;
  customerName?: string;
  requestedDeliveryDate?: string;
  teamName?: string;
  assignedUserName?: string;
  county?: string;
  totalItems?: number;
  pickedItems?: number;
  totalQty?: number;
  pickedQty?: number;
}

export interface PickItem {
  id: string;
  pickListId: string;
  orderItemId: string;
  targetQty: number;
  pickedQty: number;
  status: PickItemStatus;
  originalBatchId?: string;
  pickedBatchId?: string;
  substitutionReason?: string;
  notes?: string;
  pickedAt?: string;
  pickedBy?: string;
  locationHint?: string;
  // Joined fields
  productName?: string;
  plantVariety?: string;
  size?: string;
  originalBatchNumber?: string;
  pickedBatchNumber?: string;
  batchLocation?: string;
}

export interface CreatePickListInput {
  orderId: string;
  assignedTeamId?: string;
  sequence?: number;
}

export interface UpdatePickItemInput {
  pickItemId: string;
  pickedQty: number;
  pickedBatchId?: string;
  substitutionReason?: string;
  notes?: string;
  status?: PickItemStatus;
}

// ================================================
// TEAMS
// ================================================

export async function getPickingTeams(orgId: string): Promise<PickingTeam[]> {
  const supabase = await getSupabaseServerApp();

  try {
    const { data, error } = await supabase
      .from("picking_teams")
      .select(`
        *,
        picking_team_members(count)
      `)
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name");

    if (error) {
      // Table might not exist yet
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("picking_teams table does not exist yet. Run the migration.");
        return [];
      }
      console.error("Error fetching picking teams:", error.message || error);
      return [];
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      orgId: t.org_id,
      name: t.name,
      description: t.description,
      isActive: t.is_active,
      createdAt: t.created_at,
      memberCount: t.picking_team_members?.[0]?.count ?? 0,
    }));
  } catch (e) {
    console.error("Exception fetching picking teams:", e);
    return [];
  }
}

export async function createPickingTeam(
  orgId: string,
  name: string,
  description?: string
): Promise<{ team?: PickingTeam; error?: string }> {
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("picking_teams")
    .insert({
      org_id: orgId,
      name,
      description,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating picking team:", error);
    return { error: error.message };
  }

  return {
    team: {
      id: data.id,
      orgId: data.org_id,
      name: data.name,
      description: data.description,
      isActive: data.is_active,
      createdAt: data.created_at,
    },
  };
}

export async function addTeamMember(
  teamId: string,
  userId: string,
  isLead: boolean = false
): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from("picking_team_members")
    .insert({
      team_id: teamId,
      user_id: userId,
      is_lead: isLead,
    });

  if (error) {
    console.error("Error adding team member:", error);
    return { error: error.message };
  }

  return {};
}

export async function removeTeamMember(
  teamId: string,
  userId: string
): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from("picking_team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error removing team member:", error);
    return { error: error.message };
  }

  return {};
}

export async function getTeamMembers(teamId: string): Promise<PickingTeamMember[]> {
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("picking_team_members")
    .select(`
      *,
      profiles:user_id(display_name, email)
    `)
    .eq("team_id", teamId);

  if (error) {
    console.error("Error fetching team members:", error);
    return [];
  }

  return (data || []).map((m: any) => ({
    id: m.id,
    teamId: m.team_id,
    userId: m.user_id,
    isLead: m.is_lead,
    displayName: m.profiles?.display_name,
    email: m.profiles?.email,
  }));
}

// ================================================
// EMPLOYEES
// ================================================

export interface Employee {
  id: string;
  orgId: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

export interface TeamEmployee {
  id: string;
  teamId: string;
  employeeId: string;
  isLead: boolean;
  employeeName?: string;
  employeeRole?: string;
}

export async function getEmployees(orgId: string): Promise<Employee[]> {
  const supabase = await getSupabaseServerApp();

  try {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name");

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("employees table does not exist yet. Run the migration.");
        return [];
      }
      console.error("Error fetching employees:", error.message || error);
      return [];
    }

    return (data || []).map((e: any) => ({
      id: e.id,
      orgId: e.org_id,
      name: e.name,
      role: e.role,
      phone: e.phone,
      email: e.email,
      isActive: e.is_active,
      notes: e.notes,
      createdAt: e.created_at,
    }));
  } catch (e) {
    console.error("Exception fetching employees:", e);
    return [];
  }
}

export async function createEmployee(
  orgId: string,
  name: string,
  role?: string,
  phone?: string,
  email?: string
): Promise<{ employee?: Employee; error?: string }> {
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("employees")
    .insert({
      org_id: orgId,
      name,
      role,
      phone,
      email,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating employee:", error);
    return { error: error.message };
  }

  return {
    employee: {
      id: data.id,
      orgId: data.org_id,
      name: data.name,
      role: data.role,
      phone: data.phone,
      email: data.email,
      isActive: data.is_active,
      createdAt: data.created_at,
    },
  };
}

export async function updateEmployee(
  employeeId: string,
  updates: { name?: string; role?: string; phone?: string; email?: string; isActive?: boolean }
): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from("employees")
    .update({
      name: updates.name,
      role: updates.role,
      phone: updates.phone,
      email: updates.email,
      is_active: updates.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", employeeId);

  if (error) {
    console.error("Error updating employee:", error);
    return { error: error.message };
  }

  return {};
}

export async function getTeamEmployees(teamId: string): Promise<TeamEmployee[]> {
  const supabase = await getSupabaseServerApp();

  try {
    const { data, error } = await supabase
      .from("team_employees")
      .select(`
        *,
        employees(name, role)
      `)
      .eq("team_id", teamId);

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return [];
      }
      console.error("Error fetching team employees:", error);
      return [];
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      teamId: m.team_id,
      employeeId: m.employee_id,
      isLead: m.is_lead,
      employeeName: m.employees?.name,
      employeeRole: m.employees?.role,
    }));
  } catch (e) {
    console.error("Exception fetching team employees:", e);
    return [];
  }
}

export async function addEmployeeToTeam(
  teamId: string,
  employeeId: string,
  isLead: boolean = false
): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from("team_employees")
    .insert({
      team_id: teamId,
      employee_id: employeeId,
      is_lead: isLead,
    });

  if (error) {
    if (error.code === "23505") {
      return { error: "Employee is already assigned to this team" };
    }
    console.error("Error adding employee to team:", error);
    return { error: error.message };
  }

  return {};
}

export async function removeEmployeeFromTeam(
  teamId: string,
  employeeId: string
): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from("team_employees")
    .delete()
    .eq("team_id", teamId)
    .eq("employee_id", employeeId);

  if (error) {
    console.error("Error removing employee from team:", error);
    return { error: error.message };
  }

  return {};
}

export async function getUserTeams(userId: string): Promise<PickingTeam[]> {
  const supabase = await getSupabaseServerApp();

  try {
    const { data, error } = await supabase
      .from("picking_team_members")
      .select(`
        picking_teams(*)
      `)
      .eq("user_id", userId);

    if (error) {
      // Table might not exist yet
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("picking_team_members table does not exist yet. Run the migration.");
        return [];
      }
      console.error("Error fetching user teams:", error.message || error);
      return [];
    }

    return (data || [])
      .filter((d: any) => d.picking_teams)
      .map((d: any) => ({
        id: d.picking_teams.id,
        orgId: d.picking_teams.org_id,
        name: d.picking_teams.name,
        description: d.picking_teams.description,
        isActive: d.picking_teams.is_active,
        createdAt: d.picking_teams.created_at,
      }));
  } catch (e) {
    console.error("Exception fetching user teams:", e);
    return [];
  }
}

// ================================================
// PICK LISTS
// ================================================

export async function createPickList(
  input: CreatePickListInput
): Promise<{ pickList?: PickList; error?: string; warning?: string }> {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  // Get max sequence for the team (or org if unassigned)
  const { data: maxSeq } = await supabase
    .from("pick_lists")
    .select("sequence")
    .eq("org_id", orgId)
    .eq("assigned_team_id", input.assignedTeamId ?? null)
    .order("sequence", { ascending: false })
    .limit(1)
    .single();

  const nextSequence = input.sequence ?? ((maxSeq?.sequence ?? 0) + 1);

  const { data, error } = await supabase
    .from("pick_lists")
    .insert({
      org_id: orgId,
      order_id: input.orderId,
      assigned_team_id: input.assignedTeamId,
      sequence: nextSequence,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating pick list:", error);
    return { error: error.message };
  }

  // Get order details for task title
  const { data: orderData } = await supabase
    .from("orders")
    .select(`
      order_number,
      requested_delivery_date,
      customers(name)
    `)
    .eq("id", input.orderId)
    .single();

  // Create pick items from order items
  const { data: orderItems } = await supabase
    .from("order_items")
    .select(`
      id,
      quantity,
      skus(plant_variety_id, size_id),
      product_id
    `)
    .eq("order_id", input.orderId);

  const totalQty = orderItems?.reduce((sum, oi: any) => sum + (oi.quantity || 0), 0) ?? 0;

  if (orderItems && orderItems.length > 0) {
    // Fetch batch allocations for all order items to populate original_batch_id
    const orderItemIds = orderItems.map((oi: any) => oi.id);
    const { data: allocations } = await supabase
      .from("batch_allocations")
      .select("order_item_id, batch_id, quantity")
      .in("order_item_id", orderItemIds)
      .eq("status", "allocated");

    // Build allocation map: order_item_id -> batch_id (first allocation if multiple)
    const allocationMap = new Map<string, string>();
    for (const alloc of allocations || []) {
      if (!allocationMap.has(alloc.order_item_id)) {
        allocationMap.set(alloc.order_item_id, alloc.batch_id);
      }
    }

    // Fetch batch locations for location hints
    const batchIds = [...new Set(allocations?.map(a => a.batch_id) || [])];
    const batchLocationMap = new Map<string, string>();
    if (batchIds.length > 0) {
      const { data: batches } = await supabase
        .from("batches")
        .select("id, nursery_locations(name)")
        .in("id", batchIds);

      for (const b of batches || []) {
        const locationName = (b.nursery_locations as { name?: string })?.name || "";
        batchLocationMap.set(b.id, locationName);
      }
    }

    // Create pick items with original_batch_id populated from allocations
    const pickItems = orderItems.map((oi: any) => {
      const batchId = allocationMap.get(oi.id);
      return {
        pick_list_id: data.id,
        order_item_id: oi.id,
        target_qty: oi.quantity,
        status: "pending",
        original_batch_id: batchId || null,
        location_hint: batchId ? batchLocationMap.get(batchId) || null : null,
      };
    });

    const { error: itemsError } = await supabase
      .from("pick_items")
      .insert(pickItems);

    if (itemsError) {
      console.error("Error creating pick items:", itemsError);
    }
  }

  // Create a task in the unified tasks system
  let taskWarning: string | undefined;
  try {
    const customerName = (orderData?.customers as { name?: string })?.name || "Customer";
    await createTask({
      sourceModule: "dispatch",
      sourceRefType: "pick_list",
      sourceRefId: data.id,
      title: `Pick Order #${orderData?.order_number || "Unknown"} - ${customerName}`,
      description: `Pick list for order ${orderData?.order_number}. ${orderItems?.length || 0} line items, ${totalQty} total units.`,
      taskType: "picking",
      assignedTeamId: input.assignedTeamId,
      scheduledDate: orderData?.requested_delivery_date ?? undefined,
      plantQuantity: totalQty,
    });
  } catch (taskError) {
    console.error("Error creating task for pick list:", taskError);
    // Don't fail the pick list creation, but track that task creation failed
    taskWarning = "Pick list created but task scheduling failed. The pick list may not appear in employee schedules.";
  }

  // Log event
  await logPickListEvent(orgId, data.id, null, "created", "Pick list created");

  return {
    pickList: {
      id: data.id,
      orgId: data.org_id,
      orderId: data.order_id,
      assignedTeamId: data.assigned_team_id,
      sequence: data.sequence,
      status: data.status,
      createdAt: data.created_at,
    },
    warning: taskWarning,
  };
}

export async function getPickListsForTeam(
  teamId: string,
  statuses?: PickListStatus[]
): Promise<PickList[]> {
  const supabase = await getSupabaseServerApp();

  let query = supabase
    .from("pick_lists")
    .select(`
      *,
      orders(order_number, status, requested_delivery_date, customer_id,
        customers(name)
      ),
      picking_teams(name)
    `)
    .eq("assigned_team_id", teamId)
    .order("sequence", { ascending: true });

  if (statuses && statuses.length > 0) {
    query = query.in("status", statuses);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching pick lists for team:", error);
    return [];
  }

  return (data || []).map(mapPickListRow);
}

export async function getPickListsForOrg(
  orgId: string,
  options?: {
    statuses?: PickListStatus[];
    teamId?: string;
    limit?: number;
  }
): Promise<PickList[]> {
  const supabase = await getSupabaseServerApp();

  try {
    let query = supabase
      .from("pick_lists")
      .select(`
        *,
        orders(order_number, status, requested_delivery_date, customer_id,
          customers(name),
          customer_addresses(county)
        ),
        picking_teams(name)
      `)
      .eq("org_id", orgId)
      .order("sequence", { ascending: true });

    if (options?.statuses && options.statuses.length > 0) {
      query = query.in("status", options.statuses);
    }

    if (options?.teamId) {
      query = query.eq("assigned_team_id", options.teamId);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      // Table might not exist yet
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("pick_lists table does not exist yet. Run the migration.");
        return [];
      }
      console.error("Error fetching pick lists:", error.message || error);
      return [];
    }

    return (data || []).map(mapPickListRow);
  } catch (e) {
    console.error("Exception fetching pick lists:", e);
    return [];
  }
}

/**
 * Get all orders that need picking - including orders without pick lists created yet
 * This shows a complete view of what needs to be picked
 */
export async function getOrdersForPicking(orgId: string): Promise<PickList[]> {
  const supabase = await getSupabaseServerApp();

  try {
    // Fetch all orders in confirmed or picking status
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        requested_delivery_date,
        customer_id,
        customers(name),
        customer_addresses(county),
        pick_lists(
          id,
          sequence,
          status,
          assigned_team_id,
          assigned_user_id,
          started_at,
          completed_at,
          started_by,
          completed_by,
          notes,
          created_at,
          picking_teams(name)
        )
      `)
      .eq("org_id", orgId)
      .in("status", ["confirmed", "picking"])
      .order("requested_delivery_date", { ascending: true });

    if (ordersError) {
      console.error("Error fetching orders for picking:", ordersError);
      return [];
    }

    // Transform orders into pick list format for consistent display
    const results: PickList[] = [];
    let sequenceCounter = 1;

    for (const order of ordersData || []) {
      const pickLists = Array.isArray(order.pick_lists) 
        ? order.pick_lists 
        : (order.pick_lists ? [order.pick_lists] : []);
      
      // Handle customer_addresses which could be an array or object
      const addresses = order.customer_addresses;
      const address = Array.isArray(addresses) ? addresses[0] : addresses;

      if (pickLists.length > 0) {
        // Order has pick list(s) - include them if pending or in_progress
        for (const pl of pickLists) {
          if (pl.status === 'pending' || pl.status === 'in_progress') {
            results.push({
              id: pl.id,
              orgId: orgId,
              orderId: order.id,
              assignedTeamId: pl.assigned_team_id,
              assignedUserId: pl.assigned_user_id,
              sequence: pl.sequence || sequenceCounter++,
              status: pl.status,
              startedAt: pl.started_at,
              completedAt: pl.completed_at,
              startedBy: pl.started_by,
              completedBy: pl.completed_by,
              notes: pl.notes,
              createdAt: pl.created_at,
              orderNumber: order.order_number,
              orderStatus: order.status,
              customerName: extractName(order.customers),
              requestedDeliveryDate: order.requested_delivery_date,
              teamName: extractName(pl.picking_teams),
              county: address?.county,
            });
          }
        }
      } else {
        // Order doesn't have a pick list yet - create a virtual one for display
        // This allows users to see orders that need picking
        results.push({
          id: `pending-${order.id}`, // Virtual ID
          orgId: orgId,
          orderId: order.id,
          sequence: sequenceCounter++,
          status: 'pending' as PickListStatus,
          createdAt: new Date().toISOString(),
          orderNumber: order.order_number,
          orderStatus: order.status,
          customerName: extractName(order.customers),
          requestedDeliveryDate: order.requested_delivery_date,
          county: address?.county,
        });
      }
    }

    return results;
  } catch (e) {
    console.error("Exception fetching orders for picking:", e);
    return [];
  }
}

export async function getPickListById(pickListId: string): Promise<PickList | null> {
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("pick_lists")
    .select(`
      *,
      orders(order_number, status, requested_delivery_date, customer_id,
        customers(name),
        customer_addresses(county)
      ),
      picking_teams(name)
    `)
    .eq("id", pickListId)
    .single();

  if (error) {
    console.error("Error fetching pick list:", error);
    return null;
  }

  return mapPickListRow(data);
}

function mapPickListRow(row: any): PickList {
  // Handle customer_addresses which could be an array or object
  const addresses = row.orders?.customer_addresses;
  const address = Array.isArray(addresses) ? addresses[0] : addresses;
  
  return {
    id: row.id,
    orgId: row.org_id,
    orderId: row.order_id,
    assignedTeamId: row.assigned_team_id,
    assignedUserId: row.assigned_user_id,
    sequence: row.sequence,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    startedBy: row.started_by,
    completedBy: row.completed_by,
    notes: row.notes,
    createdAt: row.created_at,
    orderNumber: row.orders?.order_number,
    orderStatus: row.orders?.status,
    customerName: row.orders?.customers?.name,
    requestedDeliveryDate: row.orders?.requested_delivery_date,
    teamName: row.picking_teams?.name,
    county: address?.county,
  };
}

// ================================================
// PICK LIST ACTIONS
// ================================================

export async function startPickList(
  pickListId: string
): Promise<{ error?: string }> {
  const { user, orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from("pick_lists")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
      started_by: user.id,
    })
    .eq("id", pickListId)
    .eq("status", "pending");

  if (error) {
    console.error("Error starting pick list:", error);
    return { error: error.message };
  }

  // Update the corresponding task
  try {
    const task = await getTaskBySourceRef("dispatch", "pick_list", pickListId);
    if (task) {
      await updateTask(task.id, { status: "in_progress" });
    }
  } catch (taskError) {
    console.error("Error updating task for pick list start:", taskError);
  }

  await logPickListEvent(orgId, pickListId, null, "started", "Pick list started");

  return {};
}

export async function completePickList(
  pickListId: string
): Promise<{ error?: string }> {
  const { user, orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  // Check all items are picked or short
  const { data: pendingItems } = await supabase
    .from("pick_items")
    .select("id")
    .eq("pick_list_id", pickListId)
    .eq("status", "pending");

  if (pendingItems && pendingItems.length > 0) {
    return { error: `${pendingItems.length} items still pending` };
  }

  const { error } = await supabase
    .from("pick_lists")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    })
    .eq("id", pickListId)
    .eq("status", "in_progress");

  if (error) {
    console.error("Error completing pick list:", error);
    return { error: error.message };
  }

  // Update the corresponding task
  try {
    const task = await getTaskBySourceRef("dispatch", "pick_list", pickListId);
    if (task) {
      await updateTask(task.id, { status: "completed" });
    }
  } catch (taskError) {
    console.error("Error updating task for pick list completion:", taskError);
  }

  // Update order status
  const { data: pickList } = await supabase
    .from("pick_lists")
    .select("order_id")
    .eq("id", pickListId)
    .single();

  if (pickList?.order_id) {
    // Update order status to 'packed' (picking complete, ready for dispatch)
    // Valid order_status enum: draft, confirmed, picking, ready, packed, dispatched, delivered, cancelled, void
    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({ status: "packed" })
      .eq("id", pickList.order_id);

    if (orderUpdateError) {
      console.error(`[completePickList] Failed to update order status for ${pickList.order_id}:`, orderUpdateError);
    }

    // Auto-generate invoice after picking is complete
    try {
      const invoiceResult = await generateInvoice(pickList.order_id);
      if (invoiceResult.error) {
        // Log the error but don't fail the pick list completion
        console.warn(`[completePickList] Invoice generation failed for order ${pickList.order_id}:`, invoiceResult.error);
      } else {
        console.log(`[completePickList] Invoice generated for order ${pickList.order_id}`);
        await logPickListEvent(orgId, pickListId, null, "invoice_generated", "Invoice auto-generated after picking");
      }
    } catch (err) {
      console.error(`[completePickList] Error generating invoice for order ${pickList.order_id}:`, err);
      // Don't fail the pick list completion if invoice generation fails
    }
  }

  await logPickListEvent(orgId, pickListId, null, "completed", "Pick list completed");

  return {};
}

export async function assignPickListToTeam(
  pickListId: string,
  teamId: string | null
): Promise<{ error?: string }> {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from("pick_lists")
    .update({ assigned_team_id: teamId })
    .eq("id", pickListId);

  if (error) {
    console.error("Error assigning pick list to team:", error);
    return { error: error.message };
  }

  // Update the corresponding task
  try {
    const task = await getTaskBySourceRef("dispatch", "pick_list", pickListId);
    if (task) {
      await updateTask(task.id, {
        assignedTeamId: teamId,
        status: teamId ? "assigned" : "pending",
      });
    }
  } catch (taskError) {
    console.error("Error updating task for pick list assignment:", taskError);
  }

  await logPickListEvent(
    orgId,
    pickListId,
    null,
    "assigned",
    teamId ? `Assigned to team` : "Unassigned from team",
    { teamId }
  );

  return {};
}

export async function updatePickListSequence(
  pickListId: string,
  newSequence: number
): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from("pick_lists")
    .update({ sequence: newSequence })
    .eq("id", pickListId);

  if (error) {
    console.error("Error updating pick list sequence:", error);
    return { error: error.message };
  }

  return {};
}

export async function reorderPickLists(
  orgId: string,
  teamId: string | null,
  orderedIds: string[]
): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerApp();

  // Update each pick list with its new sequence
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("pick_lists")
      .update({ sequence: i + 1 })
      .eq("id", orderedIds[i]);

    if (error) {
      console.error("Error reordering pick lists:", error);
      return { error: error.message };
    }
  }

  return {};
}

// ================================================
// PICK ITEMS
// ================================================

export async function getPickItems(pickListId: string): Promise<PickItem[]> {
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("pick_items")
    .select(`
      *,
      order_items(
        description,
        quantity,
        skus(
          code,
          plant_varieties(name),
          plant_sizes(name)
        ),
        products(name)
      ),
      original_batch:original_batch_id(batch_number, nursery_locations(name)),
      picked_batch:picked_batch_id(batch_number, nursery_locations(name))
    `)
    .eq("pick_list_id", pickListId)
    .order("created_at");

  if (error) {
    console.error("Error fetching pick items:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    pickListId: row.pick_list_id,
    orderItemId: row.order_item_id,
    targetQty: row.target_qty,
    pickedQty: row.picked_qty,
    status: row.status,
    originalBatchId: row.original_batch_id,
    pickedBatchId: row.picked_batch_id,
    substitutionReason: row.substitution_reason,
    notes: row.notes,
    pickedAt: row.picked_at,
    pickedBy: row.picked_by,
    locationHint: row.location_hint,
    productName: row.order_items?.products?.name || row.order_items?.description,
    plantVariety: row.order_items?.skus?.plant_varieties?.name,
    size: row.order_items?.skus?.plant_sizes?.name,
    originalBatchNumber: row.original_batch?.batch_number,
    pickedBatchNumber: row.picked_batch?.batch_number,
    batchLocation: row.original_batch?.nursery_locations?.name || row.picked_batch?.nursery_locations?.name,
  }));
}

/**
 * Fetch pick items for multiple pick lists at once (for combined picking)
 * Returns items with their associated pick list info for order attribution
 */
export async function getPickItemsForMultipleLists(pickListIds: string[]): Promise<{
  items: (PickItem & { orderNumber?: string; customerName?: string })[];
  pickLists: { id: string; orderNumber?: string; customerName?: string }[];
}> {
  const supabase = await getSupabaseServerApp();

  if (pickListIds.length === 0) {
    return { items: [], pickLists: [] };
  }

  // Fetch pick lists with order info
  const { data: pickListsData } = await supabase
    .from("pick_lists")
    .select(`
      id,
      orders(
        order_number,
        customers(name)
      )
    `)
    .in("id", pickListIds);

  const pickListMap = new Map<string, { orderNumber?: string; customerName?: string }>();
  const pickLists = (pickListsData || []).map((pl: any) => {
    const info = {
      id: pl.id,
      orderNumber: pl.orders?.order_number,
      customerName: pl.orders?.customers?.name,
    };
    pickListMap.set(pl.id, info);
    return info;
  });

  // Fetch all pick items for these lists
  const { data, error } = await supabase
    .from("pick_items")
    .select(`
      *,
      order_items(
        description,
        quantity,
        skus(
          code,
          plant_varieties(name),
          plant_sizes(name)
        ),
        products(name)
      ),
      original_batch:original_batch_id(batch_number, nursery_locations(name)),
      picked_batch:picked_batch_id(batch_number, nursery_locations(name))
    `)
    .in("pick_list_id", pickListIds)
    .order("created_at");

  if (error) {
    console.error("Error fetching pick items for multiple lists:", error);
    return { items: [], pickLists };
  }

  const items = (data || []).map((row: any) => {
    const pickListInfo = pickListMap.get(row.pick_list_id);
    return {
      id: row.id,
      pickListId: row.pick_list_id,
      orderItemId: row.order_item_id,
      targetQty: row.target_qty,
      pickedQty: row.picked_qty,
      status: row.status,
      originalBatchId: row.original_batch_id,
      pickedBatchId: row.picked_batch_id,
      substitutionReason: row.substitution_reason,
      notes: row.notes,
      pickedAt: row.picked_at,
      pickedBy: row.picked_by,
      locationHint: row.location_hint,
      productName: row.order_items?.products?.name || row.order_items?.description,
      plantVariety: row.order_items?.skus?.plant_varieties?.name,
      size: row.order_items?.skus?.plant_sizes?.name,
      originalBatchNumber: row.original_batch?.batch_number,
      pickedBatchNumber: row.picked_batch?.batch_number,
      batchLocation: row.original_batch?.nursery_locations?.name || row.picked_batch?.nursery_locations?.name,
      orderNumber: pickListInfo?.orderNumber,
      customerName: pickListInfo?.customerName,
    };
  });

  return { items, pickLists };
}

export async function updatePickItem(
  input: UpdatePickItemInput
): Promise<{ error?: string }> {
  const { user, orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  // Get current pick item with order details for event logging
  const { data: current } = await supabase
    .from("pick_items")
    .select(
      `
        *,
        pick_lists(
          org_id,
          orders(
            id,
            order_number,
            customers(name)
          )
        ),
        order_items(
          id,
          product_id,
          required_variety_id,
          required_batch_id
        )
      `
    )
    .eq("id", input.pickItemId)
    .single();

  if (!current) {
    return { error: "Pick item not found" };
  }

  // Validate picked batch against constraints if provided
  if (input.pickedBatchId) {
    // 1) Ensure batch belongs to product (via product_batches)
    if (current.order_items?.product_id) {
      const { data: pbMatch } = await supabase
        .from("product_batches")
        .select("id")
        .eq("product_id", current.order_items.product_id)
        .eq("batch_id", input.pickedBatchId)
        .maybeSingle();
      if (!pbMatch) {
        return { error: "Picked batch does not belong to the ordered product" };
      }
    }

    // 2) Ensure variety requirement matches if set
    if (current.order_items?.required_variety_id) {
      const { data: batchRow } = await supabase
        .from("batches")
        .select("plant_variety_id")
        .eq("id", input.pickedBatchId)
        .maybeSingle();
      if (batchRow?.plant_variety_id !== current.order_items.required_variety_id) {
        return { error: "Picked batch has wrong variety for this line" };
      }
    }

    // 3) Ensure specific batch requirement matches if set
    if (
      current.order_items?.required_batch_id &&
      current.order_items.required_batch_id !== input.pickedBatchId
    ) {
      return { error: "This line requires a specific batch; scanned batch is different" };
    }
  }

  // Use atomic RPC to ensure all operations succeed or fail together
  // This prevents inconsistent state if any step fails (e.g., stock deducted but allocation not updated)
  const { data: rpcResult, error: rpcError } = await supabase.rpc("pick_item_atomic", {
    p_org_id: orgId,
    p_pick_item_id: input.pickItemId,
    p_picked_qty: input.pickedQty,
    p_picked_batch_id: input.pickedBatchId || null,
    p_user_id: user.id,
    p_status: input.status || null,
    p_substitution_reason: input.substitutionReason || null,
    p_notes: input.notes || null,
  });

  if (rpcError) {
    console.error("Error in pick_item_atomic:", rpcError);
    return { error: rpcError.message };
  }

  if (!rpcResult?.success) {
    console.error("pick_item_atomic failed:", rpcResult?.error);
    return { error: rpcResult?.error || "Failed to pick item" };
  }

  return {};
}

export async function substituteBatch(
  pickItemId: string,
  newBatchId: string,
  reason: string
): Promise<{ error?: string }> {
  const { user, orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data: current } = await supabase
    .from("pick_items")
    .select(
      `
        *,
        pick_lists(org_id),
        order_items(
          id,
          product_id,
          required_variety_id,
          required_batch_id
        )
      `
    )
    .eq("id", pickItemId)
    .single();

  if (!current) {
    return { error: "Pick item not found" };
  }

  // Validation same as updatePickItem
  {
    if (current.order_items?.product_id) {
      const { data: pbMatch } = await supabase
        .from("product_batches")
        .select("id")
        .eq("product_id", current.order_items.product_id)
        .eq("batch_id", newBatchId)
        .maybeSingle();
      if (!pbMatch) {
        return { error: "Picked batch does not belong to the ordered product" };
      }
    }

    if (current.order_items?.required_variety_id) {
      const { data: batchRow } = await supabase
        .from("batches")
        .select("plant_variety_id")
        .eq("id", newBatchId)
        .maybeSingle();
      if (batchRow?.plant_variety_id !== current.order_items.required_variety_id) {
        return { error: "Picked batch has wrong variety for this line" };
      }
    }

    if (
      current.order_items?.required_batch_id &&
      current.order_items.required_batch_id !== newBatchId
    ) {
      return { error: "This line requires a specific batch; scanned batch is different" };
    }
  }

  const { error } = await supabase
    .from("pick_items")
    .update({
      picked_batch_id: newBatchId,
      substitution_reason: reason,
      status: "substituted",
    })
    .eq("id", pickItemId);

  if (error) {
    console.error("Error substituting batch:", error);
    return { error: error.message };
  }

  await logPickListEvent(
    current.pick_lists.org_id,
    current.pick_list_id,
    pickItemId,
    "batch_substituted",
    `Batch substituted: ${reason}`,
    {
      originalBatchId: current.original_batch_id,
      newBatchId,
      reason,
    }
  );

  return {};
}

// ================================================
// AVAILABLE BATCHES FOR PICKING
// ================================================

export async function getAvailableBatchesForItem(
  pickItemId: string
): Promise<{
  id: string;
  batchNumber: string;
  quantity: number;
  location: string;
  grade?: string;
  status?: string;
}[]> {
  const supabase = await getSupabaseServerApp();

  // Get the pick item to find variety/size AND any required variety/batch constraints
  const { data: pickItem } = await supabase
    .from("pick_items")
    .select(`
      order_items(
        required_variety_id,
        required_batch_id,
        product_id,
        skus(plant_variety_id, size_id)
      )
    `)
    .eq("id", pickItemId)
    .single();

  if (!pickItem?.order_items) {
    return [];
  }

  const orderItem = pickItem.order_items as {
    required_variety_id?: string;
    required_batch_id?: string;
    product_id?: string;
    skus?: { plant_variety_id: string; size_id: string };
  };

  // If a specific batch is required, return only that batch
  if (orderItem.required_batch_id) {
    const { data: requiredBatch } = await supabase
      .from("batches")
      .select(`
        id,
        batch_number,
        quantity,
        status,
        nursery_locations(name)
      `)
      .eq("id", orderItem.required_batch_id)
      .single();

    if (!requiredBatch) return [];

    return [{
      id: requiredBatch.id,
      batchNumber: requiredBatch.batch_number,
      quantity: requiredBatch.quantity,
      location: (requiredBatch.nursery_locations as any)?.name || "Unknown",
      status: requiredBatch.status ?? undefined,
    }];
  }

  // Determine variety filter - required_variety_id takes precedence over SKU variety
  const varietyId = orderItem.required_variety_id || orderItem.skus?.plant_variety_id;
  const sizeId = orderItem.skus?.size_id;

  if (!varietyId) {
    // If no variety constraint, fall back to product-linked batches
    if (orderItem.product_id) {
      const { data: productBatches, error } = await supabase
        .from("product_batches")
        .select(`
          batches(
            id,
            batch_number,
            quantity,
            status,
            nursery_locations(name)
          )
        `)
        .eq("product_id", orderItem.product_id);

      if (error) {
        console.error("Error fetching product batches:", error);
        return [];
      }

      return (productBatches || [])
        .filter((pb: any) => pb.batches && pb.batches.quantity > 0)
        .map((pb: any) => ({
          id: pb.batches.id,
          batchNumber: pb.batches.batch_number,
          quantity: pb.batches.quantity,
          location: pb.batches.nursery_locations?.name || "Unknown",
          status: pb.batches.status,
        }));
    }
    return [];
  }

  // Get available batches with matching variety (and optionally size)
  let query = supabase
    .from("batches")
    .select(`
      id,
      batch_number,
      quantity,
      status,
      nursery_locations(name)
    `)
    .eq("plant_variety_id", varietyId)
    .gt("quantity", 0)
    .in("status", ["Ready", "Looking Good"])
    .order("planted_at", { ascending: true });

  // If size is specified on the SKU, filter by size as well
  if (sizeId) {
    query = query.eq("size_id", sizeId);
  }

  const { data: batches, error } = await query;

  if (error) {
    console.error("Error fetching available batches:", error);
    return [];
  }

  return (batches || []).map((b: any) => ({
    id: b.id,
    batchNumber: b.batch_number,
    quantity: b.quantity,
    location: b.nursery_locations?.name || "Unknown",
    status: b.status,
  }));
}

// ================================================
// HELPERS
// ================================================

async function logPickListEvent(
  orgId: string,
  pickListId: string,
  pickItemId: string | null,
  eventType: string,
  description: string,
  metadata: Record<string, any> = {}
) {
  const { user } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  await supabase.from("pick_list_events").insert({
    org_id: orgId,
    pick_list_id: pickListId,
    pick_item_id: pickItemId,
    event_type: eventType,
    description,
    metadata,
    created_by: user?.id,
  });
}

// ================================================
// AUTO-CREATE PICK LISTS
// ================================================

export async function createPickListFromOrder(
  orderId: string,
  teamId?: string
): Promise<{ pickList?: PickList; error?: string }> {
  return createPickList({
    orderId,
    assignedTeamId: teamId,
  });
}

// Check if order already has a pick list
export async function getPickListForOrder(orderId: string): Promise<PickList | null> {
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("pick_lists")
    .select(`
      *,
      orders(order_number, status, requested_delivery_date, customer_id,
        customers(name)
      ),
      picking_teams(name)
    `)
    .eq("order_id", orderId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapPickListRow(data);
}

/**
 * Delete a pick list and its associated task
 */
export async function deletePickList(pickListId: string): Promise<{ error?: string }> {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  // Delete pick items first (foreign key constraint)
  await supabase.from("pick_items").delete().eq("pick_list_id", pickListId);

  // Delete pick list events
  await supabase.from("pick_list_events").delete().eq("pick_list_id", pickListId);

  // Delete the pick list
  const { error } = await supabase
    .from("pick_lists")
    .delete()
    .eq("id", pickListId)
    .eq("org_id", orgId);

  if (error) {
    console.error("Error deleting pick list:", error);
    return { error: error.message };
  }

  // Delete the associated task
  try {
    await deleteTaskBySourceRef("dispatch", "pick_list", pickListId);
  } catch (taskError) {
    console.error("Error deleting task for pick list:", taskError);
    // Don't fail the pick list deletion if task deletion fails
  }

  return {};
}

/**
 * Cancel a pick list (soft delete - marks as cancelled)
 */
export async function cancelPickList(pickListId: string): Promise<{ error?: string }> {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from("pick_lists")
    .update({ status: "cancelled" })
    .eq("id", pickListId)
    .eq("org_id", orgId);

  if (error) {
    console.error("Error cancelling pick list:", error);
    return { error: error.message };
  }

  // Update the corresponding task
  try {
    const task = await getTaskBySourceRef("dispatch", "pick_list", pickListId);
    if (task) {
      await updateTask(task.id, { status: "cancelled" });
    }
  } catch (taskError) {
    console.error("Error updating task for pick list cancellation:", taskError);
  }

  await logPickListEvent(orgId, pickListId, null, "cancelled", "Pick list cancelled");

  return {};
}
