/**
 * Dispatch Module - Database Row Types
 *
 * Type aliases for Supabase-generated row types used in dispatch queries.
 * These provide proper typing for database query results, eliminating `any` types.
 *
 * Usage:
 *   import { DeliveryRunRow, DeliveryItemRow } from '@/lib/dispatch/db-types';
 *   const runs: DeliveryRunRow[] = data;
 */

import type { Database } from "@/lib/database.types";

// =============================================================================
// Core Table Row Types (direct Supabase returns)
// =============================================================================

/** delivery_runs table row */
export type DeliveryRunRow = Database["public"]["Tables"]["delivery_runs"]["Row"];
export type DeliveryRunInsert = Database["public"]["Tables"]["delivery_runs"]["Insert"];
export type DeliveryRunUpdate = Database["public"]["Tables"]["delivery_runs"]["Update"];

/** delivery_items table row */
export type DeliveryItemRow = Database["public"]["Tables"]["delivery_items"]["Row"];
export type DeliveryItemInsert = Database["public"]["Tables"]["delivery_items"]["Insert"];
export type DeliveryItemUpdate = Database["public"]["Tables"]["delivery_items"]["Update"];

/** order_packing table row */
export type OrderPackingRow = Database["public"]["Tables"]["order_packing"]["Row"];
export type OrderPackingInsert = Database["public"]["Tables"]["order_packing"]["Insert"];
export type OrderPackingUpdate = Database["public"]["Tables"]["order_packing"]["Update"];

/** trolleys table row */
export type TrolleyRow = Database["public"]["Tables"]["trolleys"]["Row"];
export type TrolleyInsert = Database["public"]["Tables"]["trolleys"]["Insert"];
export type TrolleyUpdate = Database["public"]["Tables"]["trolleys"]["Update"];

/** trolley_transactions table row */
export type TrolleyTransactionRow = Database["public"]["Tables"]["trolley_transactions"]["Row"];
export type TrolleyTransactionInsert = Database["public"]["Tables"]["trolley_transactions"]["Insert"];
export type TrolleyTransactionUpdate = Database["public"]["Tables"]["trolley_transactions"]["Update"];

/** order_status_updates table row */
export type OrderStatusUpdateRow = Database["public"]["Tables"]["order_status_updates"]["Row"];
export type OrderStatusUpdateInsert = Database["public"]["Tables"]["order_status_updates"]["Insert"];
export type OrderStatusUpdateUpdate = Database["public"]["Tables"]["order_status_updates"]["Update"];

/** hauliers table row */
export type HaulierRow = Database["public"]["Tables"]["hauliers"]["Row"];
export type HaulierInsert = Database["public"]["Tables"]["hauliers"]["Insert"];
export type HaulierUpdate = Database["public"]["Tables"]["hauliers"]["Update"];

/** haulier_vehicles table row */
export type HaulierVehicleRow = Database["public"]["Tables"]["haulier_vehicles"]["Row"];
export type HaulierVehicleInsert = Database["public"]["Tables"]["haulier_vehicles"]["Insert"];
export type HaulierVehicleUpdate = Database["public"]["Tables"]["haulier_vehicles"]["Update"];

/** orders table row (for joins) */
export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

/** customers table row (for joins) */
export type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

/** profiles table row (for user info in picker queries) */
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/** pick_lists table row */
export type PickListRow = Database["public"]["Tables"]["pick_lists"]["Row"];

// =============================================================================
// Enum Types
// =============================================================================

export type DeliveryRunStatusEnum = Database["public"]["Enums"]["delivery_run_status"];
export type DeliveryItemStatusEnum = Database["public"]["Enums"]["delivery_item_status"];
export type TrolleyStatusEnum = Database["public"]["Enums"]["trolley_status"];
export type PackingStatusEnum = Database["public"]["Enums"]["packing_status"];
export type VehicleTypeEnum = Database["public"]["Enums"]["vehicle_type"];

// =============================================================================
// Nested Query Result Types (for JOINs and selects with relations)
// =============================================================================

/**
 * DeliveryRun with joined haulier and vehicle data
 * Used by: listDeliveryRuns, getActiveDeliveryRuns
 */
export type DeliveryRunWithRelations = DeliveryRunRow & {
  hauliers: HaulierRow | null;
  haulier_vehicles: HaulierVehicleRow | null;
};

/**
 * DeliveryRun with items and their order data
 * Used by: getDeliveryRunWithItems
 */
export type DeliveryRunWithItems = DeliveryRunRow & {
  hauliers: HaulierRow | null;
  haulier_vehicles: HaulierVehicleRow | null;
  delivery_items: DeliveryItemWithOrder[];
};

/**
 * DeliveryItem with nested order and customer data
 * Used by: delivery item queries with order details
 */
export type DeliveryItemWithOrder = DeliveryItemRow & {
  orders: {
    id: string;
    order_number: string;
    total_inc_vat: number;
    requested_delivery_date: string | null;
    trolleys_estimated: number | null;
    status: string;
    ship_to_address_line1: string | null;
    ship_to_address_line2: string | null;
    ship_to_city: string | null;
    ship_to_county: string | null;
    ship_to_eircode: string | null;
    customers: {
      id: string;
      name: string;
    } | null;
  } | null;
};

/**
 * Haulier with nested vehicles
 * Used by: getHauliersWithVehicles
 */
export type HaulierWithVehicles = HaulierRow & {
  haulier_vehicles: HaulierVehicleRow[];
};

/**
 * Order with packing and delivery item info
 * Used by: getOrdersReadyForDispatch, dispatch board queries
 */
export type OrderWithDispatchInfo = {
  id: string;
  order_number: string;
  org_id: string;
  customer_id: string;
  requested_delivery_date: string | null;
  total_inc_vat: number;
  trolleys_estimated: number | null;
  status: string;
  ship_to_address_line1: string | null;
  ship_to_address_line2: string | null;
  ship_to_city: string | null;
  ship_to_county: string | null;
  ship_to_eircode: string | null;
  customers: {
    id: string;
    name: string;
  } | null;
  order_packing: {
    id: string;
    status: PackingStatusEnum;
    trolleys_used: number;
  }[];
  delivery_items: {
    id: string;
    status: DeliveryItemStatusEnum;
    delivery_run_id: string;
  }[];
  pick_lists: {
    id: string;
    status: string;
    assigned_user_id: string | null;
    assigned_team_id: string | null;
  }[];
};

/**
 * Dispatch board order query result
 * Used by: getDispatchBoardData
 */
export type DispatchBoardQueryRow = {
  id: string;
  order_number: string;
  org_id: string;
  customer_id: string;
  requested_delivery_date: string | null;
  total_inc_vat: number;
  trolleys_estimated: number | null;
  status: string;
  ship_to_county: string | null;
  ship_to_eircode: string | null;
  customers: {
    id: string;
    name: string;
  } | null;
  pick_lists: {
    id: string;
    status: string;
    assigned_user_id: string | null;
    trolleys_actual: number | null;
    grower_members: {
      id: string;
      display_name: string | null;
    } | null;
  }[];
  delivery_items: {
    id: string;
    status: DeliveryItemStatusEnum;
    delivery_run_id: string;
    delivery_runs: {
      id: string;
      run_number: string;
      load_name: string | null;
      color_code: string | null;
      haulier_id: string | null;
      hauliers: {
        id: string;
        name: string;
      } | null;
    } | null;
  }[];
};

/**
 * Customer trolley balance query result
 * Used by: getCustomerTrolleyBalances
 */
export type CustomerTrolleyBalanceRow = {
  customer_id: string;
  customer_name: string;
  trolleys_outstanding: number;
};

/**
 * Trolley with customer info
 * Used by: listTrolleys
 */
export type TrolleyWithCustomer = TrolleyRow & {
  customers: {
    id: string;
    name: string;
  } | null;
};

/**
 * Trolley transaction with relations
 * Used by: trolley transaction queries
 */
export type TrolleyTransactionWithRelations = TrolleyTransactionRow & {
  trolleys: {
    trolley_number: string;
  } | null;
  customers: {
    name: string;
  } | null;
};

/**
 * Pick list with order and picker info
 * Used by: picker task queries
 */
export type PickListWithDetails = PickListRow & {
  orders: {
    id: string;
    order_number: string;
    status: string;
    requested_delivery_date: string | null;
    customers: {
      id: string;
      name: string;
    } | null;
  } | null;
  grower_members: {
    id: string;
    display_name: string | null;
  } | null;
  pick_items: {
    id: string;
    quantity: number;
    quantity_picked: number;
  }[];
  qc_feedback: {
    id: string;
    resolved_at: string | null;
    picker_acknowledged_at: string | null;
  }[];
};

// =============================================================================
// Utility Types for Updates
// =============================================================================

/**
 * Partial update type that only includes valid database columns
 * Useful for building update objects from domain types
 */
export type DeliveryRunDbUpdate = Partial<{
  status: DeliveryRunStatusEnum;
  driver_name: string | null;
  vehicle_registration: string | null;
  vehicle_type: VehicleTypeEnum | null;
  planned_departure_time: string | null;
  actual_departure_time: string | null;
  estimated_return_time: string | null;
  actual_return_time: string | null;
  route_notes: string | null;
  trolleys_loaded: number;
  trolleys_returned: number;
  haulier_id: string | null;
  vehicle_id: string | null;
  load_name: string | null;
  color_code: string | null;
  display_order: number | null;
}>;

export type DeliveryItemDbUpdate = Partial<{
  status: DeliveryItemStatusEnum;
  sequence_number: number;
  estimated_delivery_time: string | null;
  actual_delivery_time: string | null;
  delivery_window_start: string | null;
  delivery_window_end: string | null;
  recipient_name: string | null;
  recipient_signature_url: string | null;
  delivery_notes: string | null;
  delivery_photo_url: string | null;
  failure_reason: string | null;
  rescheduled_to: string | null;
  trolleys_delivered: number;
  trolleys_returned: number;
  trolleys_outstanding: number | null;
}>;

export type OrderPackingDbUpdate = Partial<{
  status: PackingStatusEnum;
  trolleys_used: number;
  total_units: number | null;
  packing_notes: string | null;
  special_instructions: string | null;
  packing_started_at: string | null;
  packing_completed_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
}>;

export type TrolleyDbUpdate = Partial<{
  status: TrolleyStatusEnum;
  current_location: string | null;
  customer_id: string | null;
  delivery_run_id: string | null;
  condition_notes: string | null;
  last_inspection_date: string | null;
}>;
