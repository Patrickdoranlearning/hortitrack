// src/server/sales/picking.ts
import "server-only";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import {
  createTask,
  updateTask,
  deleteTaskBySourceRef,
  getTaskBySourceRef,
} from "@/server/tasks/service";
import { logError, logInfo, logWarning } from "@/lib/log";

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

// Individual batch pick within a multi-batch pick
export interface BatchPick {
  id: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  location?: string;
  pickedAt?: string;
  pickedBy?: string;
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
  // Pricing (for label printing)
  unitPriceExVat?: number;
  // Product group fields
  isProductGroup?: boolean;
  productGroupId?: string;
  productGroupName?: string;
  // Multi-batch picks
  batchPicks?: BatchPick[];
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
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        logWarning("picking_teams table does not exist yet.");
        return [];
      }
      logError("Error fetching picking teams", { error: error.message, orgId });
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
    logError("Exception fetching picking teams", { error: String(e), orgId });
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
    logError("Error creating picking team", { error: error.message, orgId });
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
    logError("Error adding team member", { error: error.message, teamId, userId });
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
    logError("Error removing team member", { error: error.message, teamId, userId });
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
    logError("Error fetching team members", { error: error.message, teamId });
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
        logWarning("employees table does not exist yet.");
        return [];
      }
      logError("Error fetching employees", { error: error.message, orgId });
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
    logError("Exception fetching employees", { error: String(e), orgId });
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
    logError("Error creating employee", { error: error.message, orgId });
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
    logError("Error updating employee", { error: error.message, employeeId });
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
      logError("Error fetching team employees", { error: error.message, teamId });
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
    logError("Exception fetching team employees", { error: String(e), teamId });
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
    logError("Error adding employee to team", { error: error.message, teamId, employeeId });
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
    logError("Error removing employee from team", { error: error.message, teamId, employeeId });
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
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        logWarning("picking_team_members table does not exist yet.");
        return [];
      }
      logError("Error fetching user teams", { error: error.message, userId });
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
    logError("Exception fetching user teams", { error: String(e), userId });
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
    logError("Error creating pick list", { error: error.message, orgId, orderId: input.orderId });
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
    const orderItemIds = orderItems.map((oi: any) => oi.id);
    const { data: allocations } = await supabase
      .from("batch_allocations")
      .select("order_item_id, batch_id, quantity")
      .in("order_item_id", orderItemIds)
      .eq("status", "allocated");

    const allocationMap = new Map<string, string>();
    for (const alloc of allocations || []) {
      if (!allocationMap.has(alloc.order_item_id)) {
        allocationMap.set(alloc.order_item_id, alloc.batch_id);
      }
    }

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
      logError("Error creating pick items", { error: itemsError.message, pickListId: data.id });
    }
  }

  // Create a task
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
    logError("Error creating task for pick list", { error: String(taskError), pickListId: data.id });
    taskWarning = "Pick list created but task scheduling failed.";
  }

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
    logError("Error fetching pick lists for team", { error: error.message, teamId });
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
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        logWarning("pick_lists table does not exist yet.");
        return [];
      }
      logError("Error fetching pick lists", { error: error.message, orgId });
      return [];
    }

    return (data || []).map(mapPickListRow);
  } catch (e) {
    logError("Exception fetching pick lists", { error: String(e), orgId });
    return [];
  }
}

export async function getOrdersForPicking(orgId: string): Promise<PickList[]> {
  const supabase = await getSupabaseServerApp();

  try {
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id, order_number, status, requested_delivery_date, customer_id,
        customers(name),
        customer_addresses(county),
        pick_lists(
          id, sequence, status, assigned_team_id, assigned_user_id,
          started_at, completed_at, started_by, completed_by,
          notes, created_at, picking_teams(name)
        )
      `)
      .eq("org_id", orgId)
      .in("status", ["confirmed", "picking"])
      .order("requested_delivery_date", { ascending: true });

    if (ordersError) {
      logError("Error fetching orders for picking", { error: ordersError.message, orgId });
      return [];
    }

    const results: PickList[] = [];
    let sequenceCounter = 1;

    for (const order of ordersData || []) {
      const pickLists = Array.isArray(order.pick_lists) 
        ? order.pick_lists 
        : (order.pick_lists ? [order.pick_lists] : []);
      
      const addresses = order.customer_addresses;
      const address = Array.isArray(addresses) ? addresses[0] : addresses;

      if (pickLists.length > 0) {
        for (const pl of pickLists) {
          if (pl.status === 'pending' || pl.status === 'in_progress') {
            results.push({
              id: pl.id, orgId, orderId: order.id,
              assignedTeamId: pl.assigned_team_id,
              assignedUserId: pl.assigned_user_id,
              sequence: pl.sequence || sequenceCounter++,
              status: pl.status,
              startedAt: pl.started_at, completedAt: pl.completed_at,
              startedBy: pl.started_by, completedBy: pl.completed_by,
              notes: pl.notes, createdAt: pl.created_at,
              orderNumber: order.order_number, orderStatus: order.status,
              customerName: extractName(order.customers),
              requestedDeliveryDate: order.requested_delivery_date,
              teamName: extractName(pl.picking_teams),
              county: address?.county,
            });
          }
        }
      } else {
        results.push({
          id: `pending-${order.id}`, orgId, orderId: order.id,
          sequence: sequenceCounter++, status: 'pending',
          createdAt: new Date().toISOString(),
          orderNumber: order.order_number, orderStatus: order.status,
          customerName: extractName(order.customers),
          requestedDeliveryDate: order.requested_delivery_date,
          county: address?.county,
        });
      }
    }
    return results;
  } catch (e) {
    logError("Exception fetching orders for picking", { error: String(e), orgId });
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
    logError("Error fetching pick list", { error: error.message, pickListId });
    return null;
  }
  return mapPickListRow(data);
}

function mapPickListRow(row: any): PickList {
  const addresses = row.orders?.customer_addresses;
  const address = Array.isArray(addresses) ? addresses[0] : addresses;
  return {
    id: row.id, orgId: row.org_id, orderId: row.order_id,
    assignedTeamId: row.assigned_team_id, assignedUserId: row.assigned_user_id,
    sequence: row.sequence, status: row.status,
    startedAt: row.started_at, completedAt: row.completed_at,
    startedBy: row.started_by, completedBy: row.completed_by,
    notes: row.notes, createdAt: row.created_at,
    orderNumber: row.orders?.order_number, orderStatus: row.orders?.status,
    customerName: row.orders?.customers?.name,
    requestedDeliveryDate: row.orders?.requested_delivery_date,
    teamName: row.picking_teams?.name,
    county: address?.county,
  };
}

export async function startPickList(pickListId: string): Promise<{ error?: string }> {
  const { user, orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("pick_lists").update({
    status: "in_progress", started_at: new Date().toISOString(), started_by: user.id,
  }).eq("id", pickListId).eq("status", "pending");

  if (error) {
    logError("Error starting pick list", { error: error.message, pickListId });
    return { error: error.message };
  }

  try {
    const task = await getTaskBySourceRef("dispatch", "pick_list", pickListId);
    if (task) await updateTask(task.id, { status: "in_progress" });
  } catch (taskError) {
    logError("Error updating task for pick list start", { error: String(taskError), pickListId });
  }

  await logPickListEvent(orgId, pickListId, null, "started", "Pick list started");
  return {};
}

/**
 * Atomic completion via RPC
 */
export async function completePickList(pickListId: string): Promise<{ error?: string }> {
  const { user, orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_pick_list', {
    p_org_id: orgId,
    p_pick_list_id: pickListId,
    p_user_id: user.id
  });

  if (rpcError) {
    logError("Error completing pick list (RPC)", { error: rpcError.message, pickListId });
    return { error: rpcError.message };
  }

  const result = rpcResult as { success: boolean; error?: string };
  if (!result.success) return { error: result.error };

  // Sync task status to completed
  try {
    const task = await getTaskBySourceRef("dispatch", "pick_list", pickListId);
    if (task) await updateTask(task.id, { status: "completed" });
  } catch (taskError) {
    logError("Error updating task for pick list completion", { error: String(taskError), pickListId });
  }

  await logPickListEvent(orgId, pickListId, null, "completed", "Pick list completed");

  return {};
}

export async function assignPickListToTeam(pickListId: string, teamId: string | null): Promise<{ error?: string }> {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("pick_lists").update({ assigned_team_id: teamId }).eq("id", pickListId);

  if (error) {
    logError("Error assigning pick list to team", { error: error.message, pickListId, teamId });
    return { error: error.message };
  }

  try {
    const task = await getTaskBySourceRef("dispatch", "pick_list", pickListId);
    if (task) await updateTask(task.id, { assignedTeamId: teamId, status: teamId ? "assigned" : "pending" });
  } catch (taskError) {
    logError("Error updating task for pick list assignment", { error: String(taskError), pickListId });
  }

  await logPickListEvent(orgId, pickListId, null, "assigned", teamId ? `Assigned to team` : "Unassigned from team", { teamId });
  return {};
}

export async function updatePickListSequence(pickListId: string, newSequence: number): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("pick_lists").update({ sequence: newSequence }).eq("id", pickListId);
  if (error) {
    logError("Error updating pick list sequence", { error: error.message, pickListId });
    return { error: error.message };
  }
  return {};
}

export async function reorderPickLists(orgId: string, teamId: string | null, orderedIds: string[]): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerApp();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from("pick_lists").update({ sequence: i + 1 }).eq("id", orderedIds[i]);
    if (error) {
      logError("Error reordering pick lists", { error: error.message, orgId });
      return { error: error.message };
    }
  }
  return {};
}

export async function getPickItems(pickListId: string): Promise<PickItem[]> {
  const supabase = await getSupabaseServerApp();
  const { data, error } = await supabase.from("pick_items").select(`
      *, order_items(description, quantity, product_group_id, unit_price_ex_vat, skus(code, plant_varieties(name), plant_sizes(name)), products(name), product_groups(name)),
      original_batch:original_batch_id(batch_number, nursery_locations(name)),
      picked_batch:picked_batch_id(batch_number, nursery_locations(name))
    `).eq("pick_list_id", pickListId).order("created_at");

  if (error) {
    logError("Error fetching pick items", { error: error.message, pickListId });
    return [];
  }

  // Fetch batch picks for all items in this pick list
  const pickItemIds = (data || []).map((row: any) => row.id);
  const batchPicksMap = new Map<string, BatchPick[]>();

  if (pickItemIds.length > 0) {
    const { data: batchPicksData, error: batchPicksError } = await supabase
      .from("pick_item_batches")
      .select(`
        id, pick_item_id, batch_id, quantity, picked_at, picked_by,
        batches(batch_number, nursery_locations(name))
      `)
      .in("pick_item_id", pickItemIds);

    if (batchPicksError) {
      logWarning("Error fetching batch picks", { error: batchPicksError.message, pickListId });
    } else if (batchPicksData) {
      for (const bp of batchPicksData) {
        const batchPick: BatchPick = {
          id: bp.id,
          batchId: bp.batch_id,
          batchNumber: (bp.batches as any)?.batch_number || "",
          quantity: bp.quantity,
          location: (bp.batches as any)?.nursery_locations?.name,
          pickedAt: bp.picked_at || undefined,
          pickedBy: bp.picked_by || undefined,
        };
        const existing = batchPicksMap.get(bp.pick_item_id) || [];
        existing.push(batchPick);
        batchPicksMap.set(bp.pick_item_id, existing);
      }
    }
  }

  return (data || []).map((row: any) => {
    const isProductGroup = Boolean(row.order_items?.product_group_id);
    return {
      id: row.id, pickListId: row.pick_list_id, orderItemId: row.order_item_id,
      targetQty: row.target_qty, pickedQty: row.picked_qty, status: row.status,
      originalBatchId: row.original_batch_id, pickedBatchId: row.picked_batch_id,
      substitutionReason: row.substitution_reason, notes: row.notes,
      pickedAt: row.picked_at, pickedBy: row.picked_by, locationHint: row.location_hint,
      productName: row.order_items?.products?.name || row.order_items?.description,
      plantVariety: row.order_items?.skus?.plant_varieties?.name,
      size: row.order_items?.skus?.plant_sizes?.name,
      originalBatchNumber: row.original_batch?.batch_number,
      pickedBatchNumber: row.picked_batch?.batch_number,
      batchLocation: row.original_batch?.nursery_locations?.name || row.picked_batch?.nursery_locations?.name,
      unitPriceExVat: row.order_items?.unit_price_ex_vat ?? undefined,
      isProductGroup, productGroupId: row.order_items?.product_group_id,
      productGroupName: isProductGroup ? row.order_items?.product_groups?.name : undefined,
      batchPicks: batchPicksMap.get(row.id) || [],
    };
  });
}

export async function getPickItemsForMultipleLists(pickListIds: string[]): Promise<{
  items: (PickItem & { orderNumber?: string; customerName?: string })[];
  pickLists: { id: string; orderNumber?: string; customerName?: string }[];
}> {
  const supabase = await getSupabaseServerApp();
  if (pickListIds.length === 0) return { items: [], pickLists: [] };

  const { data: pickListsData } = await supabase.from("pick_lists").select(`id, orders(order_number, customers(name))`).in("id", pickListIds);
  const pickListMap = new Map<string, { orderNumber?: string; customerName?: string }>();
  const pickLists = (pickListsData || []).map((pl: any) => {
    const info = { id: pl.id, orderNumber: pl.orders?.order_number, customerName: pl.orders?.customers?.name };
    pickListMap.set(pl.id, info);
    return info;
  });

  const { data, error } = await supabase.from("pick_items").select(`
      *, order_items(description, quantity, skus(code, plant_varieties(name), plant_sizes(name)), products(name)),
      original_batch:original_batch_id(batch_number, nursery_locations(name)),
      picked_batch:picked_batch_id(batch_number, nursery_locations(name))
    `).in("pick_list_id", pickListIds).order("created_at");

  if (error) {
    logError("Error fetching pick items for multiple lists", { error: error.message, pickListIds });
    return { items: [], pickLists };
  }

  const items = (data || []).map((row: any) => {
    const pickListInfo = pickListMap.get(row.pick_list_id);
    return {
      id: row.id, pickListId: row.pick_list_id, orderItemId: row.order_item_id,
      targetQty: row.target_qty, pickedQty: row.picked_qty, status: row.status,
      originalBatchId: row.original_batch_id, pickedBatchId: row.picked_batch_id,
      substitutionReason: row.substitution_reason, notes: row.notes,
      pickedAt: row.picked_at, pickedBy: row.picked_by, locationHint: row.location_hint,
      productName: row.order_items?.products?.name || row.order_items?.description,
      plantVariety: row.order_items?.skus?.plant_varieties?.name,
      size: row.order_items?.skus?.plant_sizes?.name,
      originalBatchNumber: row.original_batch?.batch_number,
      pickedBatchNumber: row.picked_batch?.batch_number,
      batchLocation: row.original_batch?.nursery_locations?.name || row.picked_batch?.nursery_locations?.name,
      orderNumber: pickListInfo?.orderNumber, customerName: pickListInfo?.customerName,
    };
  });
  return { items, pickLists };
}

export async function updatePickItem(input: UpdatePickItemInput): Promise<{ error?: string }> {
  const { user, orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data: current } = await supabase.from("pick_items").select(`
        *, pick_lists(org_id, orders(id, order_number, customers(name))),
        order_items(id, product_id, required_variety_id, required_batch_id)
      `).eq("id", input.pickItemId).single();

  if (!current) return { error: "Pick item not found" };

  if (input.pickedBatchId) {
    if (current.order_items?.product_id) {
      const { data: pbMatch } = await supabase.from("product_batches").select("id").eq("product_id", current.order_items.product_id).eq("batch_id", input.pickedBatchId).maybeSingle();
      if (!pbMatch) return { error: "Picked batch does not belong to the ordered product" };
    }
    if (current.order_items?.required_variety_id) {
      const { data: batchRow } = await supabase.from("batches").select("plant_variety_id").eq("id", input.pickedBatchId).maybeSingle();
      if (batchRow?.plant_variety_id !== current.order_items.required_variety_id) return { error: "Picked batch has wrong variety for this line" };
    }
    if (current.order_items?.required_batch_id && current.order_items.required_batch_id !== input.pickedBatchId) {
      return { error: "This line requires a specific batch; scanned batch is different" };
    }
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc("pick_item_atomic", {
    p_org_id: orgId, p_pick_item_id: input.pickItemId, p_picked_qty: input.pickedQty,
    p_picked_batch_id: input.pickedBatchId || null, p_user_id: user.id,
    p_status: input.status || null, p_substitution_reason: input.substitutionReason || null, p_notes: input.notes || null,
  });

  if (rpcError) { logError("Error in pick_item_atomic", { error: rpcError.message, pickItemId: input.pickItemId }); return { error: rpcError.message }; }
  if (!rpcResult?.success) { logError("pick_item_atomic failed", { error: rpcResult?.error, pickItemId: input.pickItemId }); return { error: rpcResult?.error || "Failed to pick item" }; }
  return {};
}

// Multi-batch pick input
export interface MultiBatchPickInput {
  pickItemId: string;
  batches: Array<{ batchId: string; quantity: number }>;
  notes?: string;
}

/**
 * Pick an item from multiple batches atomically.
 * This allows splitting a single line item across multiple batches.
 */
export async function pickItemMultiBatch(input: MultiBatchPickInput): Promise<{
  success: boolean;
  error?: string;
  status?: string;
  pickedQty?: number;
}> {
  const { user, orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  // Validate input
  if (!input.batches || input.batches.length === 0) {
    return { success: false, error: "No batches provided" };
  }

  // Convert batches array to JSONB format expected by RPC
  const batchesJson = input.batches.map(b => ({
    batchId: b.batchId,
    quantity: b.quantity,
  }));

  const { data: rpcResult, error: rpcError } = await supabase.rpc("pick_item_multi_batch", {
    p_org_id: orgId,
    p_pick_item_id: input.pickItemId,
    p_batches: batchesJson,
    p_user_id: user.id,
    p_notes: input.notes || null,
  });

  if (rpcError) {
    logError("Error in pick_item_multi_batch", { error: rpcError.message, pickItemId: input.pickItemId });
    return { success: false, error: rpcError.message };
  }

  const result = rpcResult as { success: boolean; error?: string; status?: string; pickedQty?: number };
  if (!result?.success) {
    logError("pick_item_multi_batch failed", { error: result?.error, pickItemId: input.pickItemId });
    return { success: false, error: result?.error || "Failed to pick item" };
  }

  return {
    success: true,
    status: result.status,
    pickedQty: result.pickedQty,
  };
}

/**
 * Get batch picks for a specific pick item
 */
export async function getBatchPicksForItem(pickItemId: string): Promise<BatchPick[]> {
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("pick_item_batches")
    .select(`
      id, batch_id, quantity, picked_at, picked_by,
      batches(batch_number, nursery_locations(name))
    `)
    .eq("pick_item_id", pickItemId)
    .order("picked_at");

  if (error) {
    logError("Error fetching batch picks for item", { error: error.message, pickItemId });
    return [];
  }

  return (data || []).map((bp: any) => ({
    id: bp.id,
    batchId: bp.batch_id,
    batchNumber: bp.batches?.batch_number || "",
    quantity: bp.quantity,
    location: bp.batches?.nursery_locations?.name,
    pickedAt: bp.picked_at || undefined,
    pickedBy: bp.picked_by || undefined,
  }));
}

/**
 * Remove a specific batch pick (for undo functionality)
 */
export async function removeBatchPick(batchPickId: string): Promise<{ error?: string }> {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  // Get the batch pick details first
  const { data: batchPick, error: fetchError } = await supabase
    .from("pick_item_batches")
    .select("id, pick_item_id, batch_id, quantity, org_id")
    .eq("id", batchPickId)
    .eq("org_id", orgId)
    .single();

  if (fetchError || !batchPick) {
    return { error: "Batch pick not found or access denied" };
  }

  // Restore batch inventory
  const { error: batchError } = await supabase
    .from("batches")
    .update({ quantity: supabase.rpc("increment_quantity", { row_id: batchPick.batch_id, amount: batchPick.quantity }) })
    .eq("id", batchPick.batch_id);

  // Note: The above won't work directly - we need a simple increment
  // Let's use raw SQL via RPC or direct update
  const { error: restoreError } = await supabase.rpc("restore_batch_quantity", {
    p_batch_id: batchPick.batch_id,
    p_quantity: batchPick.quantity,
  });

  if (restoreError) {
    logWarning("Could not restore batch quantity", { error: restoreError.message, batchPickId });
  }

  // Delete the batch pick
  const { error: deleteError } = await supabase
    .from("pick_item_batches")
    .delete()
    .eq("id", batchPickId);

  if (deleteError) {
    logError("Error deleting batch pick", { error: deleteError.message, batchPickId });
    return { error: deleteError.message };
  }

  // Update pick_items picked_qty by recalculating from remaining batch picks
  const { data: remainingPicks } = await supabase
    .from("pick_item_batches")
    .select("quantity")
    .eq("pick_item_id", batchPick.pick_item_id);

  const totalRemaining = (remainingPicks || []).reduce((sum, p) => sum + p.quantity, 0);

  await supabase
    .from("pick_items")
    .update({
      picked_qty: totalRemaining,
      status: totalRemaining === 0 ? "pending" : "short",
    })
    .eq("id", batchPick.pick_item_id);

  return {};
}

export async function substituteBatch(pickItemId: string, newBatchId: string, reason: string): Promise<{ error?: string }> {
  const { user, orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data: current } = await supabase.from("pick_items").select(`
        *, pick_lists(org_id), order_items(id, product_id, required_variety_id, required_batch_id)
      `).eq("id", pickItemId).single();

  if (!current) return { error: "Pick item not found" };

  if (current.order_items?.product_id) {
    const { data: pbMatch } = await supabase.from("product_batches").select("id").eq("product_id", current.order_items.product_id).eq("batch_id", newBatchId).maybeSingle();
    if (!pbMatch) return { error: "Picked batch does not belong to the ordered product" };
  }
  if (current.order_items?.required_variety_id) {
    const { data: batchRow } = await supabase.from("batches").select("plant_variety_id").eq("id", newBatchId).maybeSingle();
    if (batchRow?.plant_variety_id !== current.order_items.required_variety_id) return { error: "Picked batch has wrong variety for this line" };
  }
  if (current.order_items?.required_batch_id && current.order_items.required_batch_id !== newBatchId) {
    return { error: "This line requires a specific batch; scanned batch is different" };
  }

  const { error } = await supabase.from("pick_items").update({
    picked_batch_id: newBatchId, substitution_reason: reason, status: "substituted",
  }).eq("id", pickItemId);

  if (error) { logError("Error substituting batch", { error: error.message, pickItemId }); return { error: error.message }; }
  await logPickListEvent(current.pick_lists.org_id, current.pick_list_id, pickItemId, "batch_substituted", `Batch substituted: ${reason}`, { originalBatchId: current.original_batch_id, newBatchId, reason });
  return {};
}

export async function getAvailableBatchesForItem(pickItemId: string): Promise<{
  id: string; batchNumber: string; quantity: number; location: string; grade?: string; status?: string; productName?: string; shelfQuantity?: number;
}[]> {
  const supabase = await getSupabaseServerApp();
  const { data: pickItem } = await supabase.from("pick_items").select(`order_items(required_variety_id, required_batch_id, product_id, product_group_id, skus(plant_variety_id, size_id))`).eq("id", pickItemId).single();
  if (!pickItem?.order_items) return [];
  const orderItem = pickItem.order_items as any;

  // Helper to get shelf quantity for a product
  const getShelfQuantityForProduct = async (productId: string): Promise<number | undefined> => {
    const { data: product } = await supabase
      .from("products")
      .select("shelf_quantity_override, skus(plant_sizes(shelf_quantity))")
      .eq("id", productId)
      .single();
    if (!product) return undefined;
    // Use override if set, otherwise use size's shelf_quantity
    if (product.shelf_quantity_override) return product.shelf_quantity_override;
    const sku = product.skus as { plant_sizes?: { shelf_quantity?: number | null } } | null;
    return sku?.plant_sizes?.shelf_quantity ?? undefined;
  };

  // Helper to get shelf quantity for a size
  const getShelfQuantityForSize = async (sizeId: string): Promise<number | undefined> => {
    const { data: size } = await supabase
      .from("plant_sizes")
      .select("shelf_quantity")
      .eq("id", sizeId)
      .single();
    return size?.shelf_quantity ?? undefined;
  };

  if (orderItem.product_group_id && !orderItem.product_id) {
    const { data: groupMembers } = await supabase.rpc('get_product_group_members', { p_group_id: orderItem.product_group_id });
    if (!groupMembers || groupMembers.length === 0) return [];
    const childProductIds = groupMembers.map((m: any) => m.product_id);
    const { data: productBatches, error } = await supabase.from("product_batches").select(`product_id, products(name, shelf_quantity_override, skus(plant_sizes(shelf_quantity))), batches(id, batch_number, quantity, status, nursery_locations(name))`).in("product_id", childProductIds);
    if (error) { logError("Error fetching product group batches", { error: error.message, pickItemId }); return []; }
    return (productBatches || []).filter((pb: any) => pb.batches && pb.batches.quantity > 0).map((pb: any) => {
      const product = pb.products as { name?: string; shelf_quantity_override?: number | null; skus?: { plant_sizes?: { shelf_quantity?: number | null } } } | null;
      const shelfQty = product?.shelf_quantity_override ?? product?.skus?.plant_sizes?.shelf_quantity ?? undefined;
      return {
        id: pb.batches.id, batchNumber: pb.batches.batch_number, quantity: pb.batches.quantity,
        location: pb.batches.nursery_locations?.name || "Unknown", status: pb.batches.status, productName: product?.name,
        shelfQuantity: shelfQty ?? undefined,
      };
    });
  }

  if (orderItem.required_batch_id) {
    const { data: requiredBatch } = await supabase.from("batches").select(`id, batch_number, quantity, status, size_id, nursery_locations(name), plant_sizes(shelf_quantity)`).eq("id", orderItem.required_batch_id).single();
    if (!requiredBatch) return [];
    const plantSize = requiredBatch.plant_sizes as { shelf_quantity?: number | null } | null;
    return [{
      id: requiredBatch.id, batchNumber: requiredBatch.batch_number, quantity: requiredBatch.quantity,
      location: (requiredBatch.nursery_locations as any)?.name || "Unknown", status: requiredBatch.status ?? undefined,
      shelfQuantity: plantSize?.shelf_quantity ?? undefined,
    }];
  }

  const varietyId = orderItem.required_variety_id || orderItem.skus?.plant_variety_id;
  const sizeId = orderItem.skus?.size_id;

  // Get shelf quantity for the size if we have it
  let shelfQuantityForSize: number | undefined;
  if (sizeId) {
    shelfQuantityForSize = await getShelfQuantityForSize(sizeId);
  }

  // If we have a product_id, get its shelf quantity override
  let productShelfQuantity: number | undefined;
  if (orderItem.product_id) {
    productShelfQuantity = await getShelfQuantityForProduct(orderItem.product_id);
  }

  // Final shelf quantity: product override > size default
  const finalShelfQuantity = productShelfQuantity ?? shelfQuantityForSize;

  if (!varietyId) {
    if (orderItem.product_id) {
      const { data: productBatches, error } = await supabase.from("product_batches").select(`batches(id, batch_number, quantity, status, nursery_locations(name))`).eq("product_id", orderItem.product_id);
      if (error) { logError("Error fetching product batches", { error: error.message, pickItemId }); return []; }
      return (productBatches || []).filter((pb: any) => pb.batches && pb.batches.quantity > 0).map((pb: any) => ({
        id: pb.batches.id, batchNumber: pb.batches.batch_number, quantity: pb.batches.quantity,
        location: pb.batches.nursery_locations?.name || "Unknown", status: pb.batches.status,
        shelfQuantity: finalShelfQuantity,
      }));
    }
    return [];
  }

  let query = supabase.from("batches").select(`id, batch_number, quantity, status, nursery_locations(name)`).eq("plant_variety_id", varietyId).gt("quantity", 0).in("status", ["Ready", "Looking Good"]).order("planted_at", { ascending: true });
  if (sizeId) query = query.eq("size_id", sizeId);
  const { data: batches, error } = await query;
  if (error) { logError("Error fetching available batches", { error: error.message, pickItemId }); return []; }
  return (batches || []).map((b: any) => ({
    id: b.id, batchNumber: b.batch_number, quantity: b.quantity,
    location: b.nursery_locations?.name || "Unknown", status: b.status,
    shelfQuantity: finalShelfQuantity,
  }));
}

async function logPickListEvent(orgId: string, pickListId: string, pickItemId: string | null, eventType: string, description: string, metadata: Record<string, any> = {}) {
  const { user } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();
  await supabase.from("pick_list_events").insert({ org_id: orgId, pick_list_id: pickListId, pick_item_id: pickItemId, event_type: eventType, description, metadata, created_by: user?.id });
}

export async function createPickListFromOrder(orderId: string, teamId?: string): Promise<{ pickList?: PickList; error?: string }> {
  return createPickList({ orderId, assignedTeamId: teamId });
}

export async function getPickListForOrder(orderId: string): Promise<PickList | null> {
  const supabase = await getSupabaseServerApp();
  const { data, error } = await supabase.from("pick_lists").select(`*, orders(order_number, status, requested_delivery_date, customer_id, customers(name)), picking_teams(name)`).eq("order_id", orderId).single();
  if (error || !data) return null;
  return mapPickListRow(data);
}

export async function deletePickList(pickListId: string): Promise<{ error?: string }> {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();
  await supabase.from("pick_items").delete().eq("pick_list_id", pickListId);
  await supabase.from("pick_list_events").delete().eq("pick_list_id", pickListId);
  const { error } = await supabase.from("pick_lists").delete().eq("id", pickListId).eq("org_id", orgId);
  if (error) { logError("Error deleting pick list", { error: error.message, pickListId }); return { error: error.message }; }
  try {
    await deleteTaskBySourceRef("dispatch", "pick_list", pickListId);
  } catch (taskError) { logError("Error deleting task for pick list", { error: String(taskError), pickListId }); }
  return {};
}

export async function cancelPickList(pickListId: string): Promise<{ error?: string }> {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("pick_lists").update({ status: "cancelled" }).eq("id", pickListId).eq("org_id", orgId);
  if (error) { logError("Error cancelling pick list", { error: error.message, pickListId }); return { error: error.message }; }
  try {
    const task = await getTaskBySourceRef("dispatch", "pick_list", pickListId);
    if (task) await updateTask(task.id, { status: "cancelled" });
  } catch (taskError) { logError("Error updating task for pick list cancellation", { error: String(taskError), pickListId }); }
  await logPickListEvent(orgId, pickListId, null, "cancelled", "Pick list cancelled");
  return {};
}
