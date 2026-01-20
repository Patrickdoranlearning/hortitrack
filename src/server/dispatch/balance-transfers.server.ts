import "server-only";
import { getUserAndOrg } from "@/server/auth/org";

// ================================================
// TYPES
// ================================================

export type PendingTransfer = {
  id: string;
  orgId: string;
  fromHaulierId: string;
  fromHaulierName: string;
  toCustomerId: string;
  toCustomerName: string;
  trolleys: number;
  shelves: number;
  deliveryRunId: string | null;
  deliveryRunNumber: string | null;
  reason: string;
  driverNotes: string | null;
  signedDocketUrl: string | null;
  photoUrl: string | null;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedByName: string | null;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
};

export type TransferRequestInput = {
  fromHaulierId: string;
  toCustomerId: string;
  trolleys: number;
  shelves?: number;
  deliveryRunId?: string;
  deliveryItemId?: string;
  reason: string;
  driverNotes?: string;
  signedDocketUrl?: string;
  photoUrl?: string;
};

export type HaulierBalance = {
  haulierId: string;
  haulierName: string;
  trolleysOut: number;
  shelvesOut: number;
  lastLoadDate: string | null;
  lastReturnDate: string | null;
};

// ================================================
// PENDING TRANSFER QUERIES
// ================================================

/**
 * Get all pending transfers awaiting approval
 */
export async function getPendingTransfers(): Promise<PendingTransfer[]> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("pending_balance_transfers")
    .select(
      `
      id,
      org_id,
      from_haulier_id,
      to_customer_id,
      trolleys,
      shelves,
      delivery_run_id,
      reason,
      driver_notes,
      signed_docket_url,
      photo_url,
      status,
      requested_by,
      requested_at,
      reviewed_by,
      reviewed_at,
      review_notes,
      hauliers!pending_balance_transfers_haulier_fkey (
        id,
        name
      ),
      customers!pending_balance_transfers_customer_fkey (
        id,
        name
      ),
      delivery_runs (
        id,
        run_number
      )
    `
    )
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("requested_at", { ascending: false });

  if (error) {
    console.error("Error fetching pending transfers:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    fromHaulierId: row.from_haulier_id,
    fromHaulierName: row.hauliers?.name || "Unknown",
    toCustomerId: row.to_customer_id,
    toCustomerName: row.customers?.name || "Unknown",
    trolleys: row.trolleys,
    shelves: row.shelves,
    deliveryRunId: row.delivery_run_id,
    deliveryRunNumber: row.delivery_runs?.run_number || null,
    reason: row.reason,
    driverNotes: row.driver_notes,
    signedDocketUrl: row.signed_docket_url,
    photoUrl: row.photo_url,
    status: row.status,
    requestedBy: row.requested_by,
    requestedByName: null, // Would need a join to profiles
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by,
    reviewedByName: null,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
  }));
}

/**
 * Get transfer history (approved and rejected)
 */
export async function getTransferHistory(
  limit: number = 50
): Promise<PendingTransfer[]> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("pending_balance_transfers")
    .select(
      `
      id,
      org_id,
      from_haulier_id,
      to_customer_id,
      trolleys,
      shelves,
      delivery_run_id,
      reason,
      driver_notes,
      signed_docket_url,
      photo_url,
      status,
      requested_by,
      requested_at,
      reviewed_by,
      reviewed_at,
      review_notes,
      hauliers!pending_balance_transfers_haulier_fkey (
        id,
        name
      ),
      customers!pending_balance_transfers_customer_fkey (
        id,
        name
      ),
      delivery_runs (
        id,
        run_number
      )
    `
    )
    .eq("org_id", orgId)
    .in("status", ["approved", "rejected"])
    .order("reviewed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching transfer history:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    fromHaulierId: row.from_haulier_id,
    fromHaulierName: row.hauliers?.name || "Unknown",
    toCustomerId: row.to_customer_id,
    toCustomerName: row.customers?.name || "Unknown",
    trolleys: row.trolleys,
    shelves: row.shelves,
    deliveryRunId: row.delivery_run_id,
    deliveryRunNumber: row.delivery_runs?.run_number || null,
    reason: row.reason,
    driverNotes: row.driver_notes,
    signedDocketUrl: row.signed_docket_url,
    photoUrl: row.photo_url,
    status: row.status,
    requestedBy: row.requested_by,
    requestedByName: null,
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by,
    reviewedByName: null,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
  }));
}

/**
 * Get count of pending transfers (for notification badge)
 */
export async function getPendingTransferCount(): Promise<number> {
  const { orgId, supabase } = await getUserAndOrg();

  const { count, error } = await supabase
    .from("pending_balance_transfers")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "pending");

  if (error) {
    console.error("Error fetching pending transfer count:", error);
    return 0;
  }

  return count || 0;
}

// ================================================
// TRANSFER MUTATIONS
// ================================================

/**
 * Request a balance transfer (called by driver when customer doesn't return trolleys)
 */
export async function requestBalanceTransfer(
  input: TransferRequestInput
): Promise<{ success: boolean; transferId?: string; error?: string }> {
  const { orgId, user, supabase } = await getUserAndOrg();

  // Validate input
  if (!input.fromHaulierId || !input.toCustomerId) {
    return { success: false, error: "Haulier and customer are required" };
  }

  if (input.trolleys <= 0 && (!input.shelves || input.shelves <= 0)) {
    return { success: false, error: "Must transfer at least 1 trolley or shelf" };
  }

  const { data, error } = await supabase
    .from("pending_balance_transfers")
    .insert({
      org_id: orgId,
      from_haulier_id: input.fromHaulierId,
      to_customer_id: input.toCustomerId,
      trolleys: input.trolleys,
      shelves: input.shelves || 0,
      delivery_run_id: input.deliveryRunId || null,
      delivery_item_id: input.deliveryItemId || null,
      reason: input.reason,
      driver_notes: input.driverNotes || null,
      signed_docket_url: input.signedDocketUrl || null,
      photo_url: input.photoUrl || null,
      requested_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating transfer request:", error);
    return { success: false, error: error.message };
  }

  return { success: true, transferId: data?.id };
}

/**
 * Approve a pending transfer (manager only)
 * Uses database function for atomic operation
 */
export async function approveTransfer(
  transferId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const { user, supabase } = await getUserAndOrg();

  const { data, error } = await supabase.rpc("apply_balance_transfer", {
    p_transfer_id: transferId,
    p_reviewer_id: user.id,
    p_notes: notes || null,
  });

  if (error) {
    console.error("Error approving transfer:", error);
    return { success: false, error: error.message };
  }

  if (!data?.success) {
    return { success: false, error: data?.error || "Failed to approve transfer" };
  }

  return { success: true };
}

/**
 * Reject a pending transfer (manager only)
 */
export async function rejectTransfer(
  transferId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const { user, supabase } = await getUserAndOrg();

  const { data, error } = await supabase.rpc("reject_balance_transfer", {
    p_transfer_id: transferId,
    p_reviewer_id: user.id,
    p_notes: notes || null,
  });

  if (error) {
    console.error("Error rejecting transfer:", error);
    return { success: false, error: error.message };
  }

  if (!data?.success) {
    return { success: false, error: data?.error || "Failed to reject transfer" };
  }

  return { success: true };
}

// ================================================
// HAULIER BALANCE QUERIES
// ================================================

/**
 * Get all haulier balances
 */
export async function getAllHaulierBalances(): Promise<HaulierBalance[]> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("haulier_trolley_balance")
    .select(
      `
      haulier_id,
      trolleys_out,
      shelves_out,
      last_load_date,
      last_return_date,
      hauliers (
        id,
        name
      )
    `
    )
    .eq("org_id", orgId)
    .gt("trolleys_out", 0);

  if (error) {
    console.error("Error fetching haulier balances:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    haulierId: row.haulier_id,
    haulierName: row.hauliers?.name || "Unknown",
    trolleysOut: row.trolleys_out || 0,
    shelvesOut: row.shelves_out || 0,
    lastLoadDate: row.last_load_date,
    lastReturnDate: row.last_return_date,
  }));
}

/**
 * Get haulier balance for a specific haulier
 */
export async function getHaulierBalance(
  haulierId: string
): Promise<HaulierBalance | null> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("haulier_trolley_balance")
    .select(
      `
      haulier_id,
      trolleys_out,
      shelves_out,
      last_load_date,
      last_return_date,
      hauliers (
        id,
        name
      )
    `
    )
    .eq("org_id", orgId)
    .eq("haulier_id", haulierId)
    .single();

  if (error || !data) {
    // Return zero balance if no record exists
    const { data: haulier } = await supabase
      .from("hauliers")
      .select("name")
      .eq("id", haulierId)
      .single();

    return {
      haulierId,
      haulierName: haulier?.name || "Unknown",
      trolleysOut: 0,
      shelvesOut: 0,
      lastLoadDate: null,
      lastReturnDate: null,
    };
  }

  return {
    haulierId: data.haulier_id,
    haulierName: (data.hauliers as any)?.name || "Unknown",
    trolleysOut: data.trolleys_out || 0,
    shelvesOut: data.shelves_out || 0,
    lastLoadDate: data.last_load_date,
    lastReturnDate: data.last_return_date,
  };
}
