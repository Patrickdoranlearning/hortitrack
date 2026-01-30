import "server-only";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";

// ================================================
// TYPES
// ================================================

/** Query result type for pending transfer with joins (PostgREST returns arrays for joins) */
type PendingTransferQueryRow = {
  id: string;
  org_id: string;
  from_haulier_id: string;
  to_customer_id: string;
  trolleys: number;
  shelves: number;
  delivery_run_id: string | null;
  reason: string;
  driver_notes: string | null;
  signed_docket_url: string | null;
  photo_url: string | null;
  status: string;
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  hauliers: { id: string; name: string } | { id: string; name: string }[] | null;
  customers: { id: string; name: string } | { id: string; name: string }[] | null;
  delivery_runs: { id: string; run_number: string } | { id: string; run_number: string }[] | null;
};

/** Query result type for haulier balance with join */
type HaulierBalanceQueryRow = {
  haulier_id: string;
  trolleys_out: number;
  shelves_out: number;
  last_load_date: string | null;
  last_return_date: string | null;
  hauliers: { id: string; name: string } | { id: string; name: string }[] | null;
};

/** Helper to get first element from array or value itself */
function asSingle<T>(val: T | T[] | null): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

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
    logger.trolley.error("Error fetching pending transfers", error, { orgId });
    return [];
  }

  return (data || []).map((row) => {
    const typedRow = row as unknown as PendingTransferQueryRow;
    const haulier = asSingle(typedRow.hauliers);
    const customer = asSingle(typedRow.customers);
    const run = asSingle(typedRow.delivery_runs);
    return {
      id: typedRow.id,
      orgId: typedRow.org_id,
      fromHaulierId: typedRow.from_haulier_id,
      fromHaulierName: haulier?.name || "Unknown",
      toCustomerId: typedRow.to_customer_id,
      toCustomerName: customer?.name || "Unknown",
      trolleys: typedRow.trolleys,
      shelves: typedRow.shelves,
      deliveryRunId: typedRow.delivery_run_id,
      deliveryRunNumber: run?.run_number || null,
      reason: typedRow.reason,
      driverNotes: typedRow.driver_notes,
      signedDocketUrl: typedRow.signed_docket_url,
      photoUrl: typedRow.photo_url,
      status: typedRow.status as "pending" | "approved" | "rejected",
      requestedBy: typedRow.requested_by,
      requestedByName: null, // Would need a join to profiles
      requestedAt: typedRow.requested_at,
      reviewedBy: typedRow.reviewed_by,
      reviewedByName: null,
      reviewedAt: typedRow.reviewed_at,
      reviewNotes: typedRow.review_notes,
    };
  });
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
    logger.trolley.error("Error fetching transfer history", error, { orgId });
    return [];
  }

  return (data || []).map((row) => {
    const typedRow = row as unknown as PendingTransferQueryRow;
    const haulier = asSingle(typedRow.hauliers);
    const customer = asSingle(typedRow.customers);
    const run = asSingle(typedRow.delivery_runs);
    return {
      id: typedRow.id,
      orgId: typedRow.org_id,
      fromHaulierId: typedRow.from_haulier_id,
      fromHaulierName: haulier?.name || "Unknown",
      toCustomerId: typedRow.to_customer_id,
      toCustomerName: customer?.name || "Unknown",
      trolleys: typedRow.trolleys,
      shelves: typedRow.shelves,
      deliveryRunId: typedRow.delivery_run_id,
      deliveryRunNumber: run?.run_number || null,
      reason: typedRow.reason,
      driverNotes: typedRow.driver_notes,
      signedDocketUrl: typedRow.signed_docket_url,
      photoUrl: typedRow.photo_url,
      status: typedRow.status as "pending" | "approved" | "rejected",
      requestedBy: typedRow.requested_by,
      requestedByName: null,
      requestedAt: typedRow.requested_at,
      reviewedBy: typedRow.reviewed_by,
      reviewedByName: null,
      reviewedAt: typedRow.reviewed_at,
      reviewNotes: typedRow.review_notes,
    };
  });
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
    logger.trolley.error("Error fetching pending transfer count", error, { orgId });
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
    logger.trolley.error("Error creating transfer request", error, { orgId, input });
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
    logger.trolley.error("Error approving transfer", error, { transferId });
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
    logger.trolley.error("Error rejecting transfer", error, { transferId });
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
    logger.trolley.error("Error fetching haulier balances", error, { orgId });
    return [];
  }

  return (data || []).map((row) => {
    const typedRow = row as unknown as HaulierBalanceQueryRow;
    const haulier = asSingle(typedRow.hauliers);
    return {
      haulierId: typedRow.haulier_id,
      haulierName: haulier?.name || "Unknown",
      trolleysOut: typedRow.trolleys_out || 0,
      shelvesOut: typedRow.shelves_out || 0,
      lastLoadDate: typedRow.last_load_date,
      lastReturnDate: typedRow.last_return_date,
    };
  });
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

  const haulierData = data as unknown as HaulierBalanceQueryRow;
  const haulier = asSingle(haulierData.hauliers);
  return {
    haulierId: haulierData.haulier_id,
    haulierName: haulier?.name || "Unknown",
    trolleysOut: haulierData.trolleys_out || 0,
    shelvesOut: haulierData.shelves_out || 0,
    lastLoadDate: haulierData.last_load_date,
    lastReturnDate: haulierData.last_return_date,
  };
}
