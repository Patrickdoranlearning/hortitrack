/**
 * Dispatch Status Management
 * Defines status workflows and validation for delivery runs and packing
 */

import type {
  DeliveryRunStatusType,
  DeliveryItemStatusType,
  PackingStatusType,
  TrolleyStatusType,
} from "@/lib/dispatch/types";

// ================================================
// DELIVERY RUN STATUS WORKFLOW
// ================================================

export const DELIVERY_RUN_STATUSES: DeliveryRunStatusType[] = [
  "planned",
  "loading",
  "in_transit",
  "completed",
  "cancelled",
];

export const DELIVERY_RUN_STATUS_LABELS: Record<DeliveryRunStatusType, string> = {
  planned: "Planned",
  loading: "Loading",
  in_transit: "In Transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const DELIVERY_RUN_STATUS_COLORS: Record<
  DeliveryRunStatusType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  planned: "outline",
  loading: "secondary",
  in_transit: "default",
  completed: "default",
  cancelled: "destructive",
};

/**
 * Valid status transitions for delivery runs
 */
export const DELIVERY_RUN_TRANSITIONS: Record<DeliveryRunStatusType, DeliveryRunStatusType[]> = {
  planned: ["loading", "cancelled"],
  loading: ["in_transit", "planned", "cancelled"],
  in_transit: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * Check if a delivery run status transition is valid
 */
export function canTransitionDeliveryRun(
  from: DeliveryRunStatusType,
  to: DeliveryRunStatusType
): boolean {
  return DELIVERY_RUN_TRANSITIONS[from].includes(to);
}

// ================================================
// DELIVERY ITEM STATUS WORKFLOW
// ================================================

export const DELIVERY_ITEM_STATUSES: DeliveryItemStatusType[] = [
  "pending",
  "loading",
  "in_transit",
  "delivered",
  "failed",
  "rescheduled",
];

export const DELIVERY_ITEM_STATUS_LABELS: Record<DeliveryItemStatusType, string> = {
  pending: "Pending",
  loading: "Loading",
  in_transit: "In Transit",
  delivered: "Delivered",
  failed: "Failed",
  rescheduled: "Rescheduled",
};

export const DELIVERY_ITEM_STATUS_COLORS: Record<
  DeliveryItemStatusType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  loading: "secondary",
  in_transit: "default",
  delivered: "default",
  failed: "destructive",
  rescheduled: "secondary",
};

/**
 * Valid status transitions for delivery items
 */
export const DELIVERY_ITEM_TRANSITIONS: Record<DeliveryItemStatusType, DeliveryItemStatusType[]> = {
  pending: ["loading", "rescheduled"],
  loading: ["in_transit", "pending"],
  in_transit: ["delivered", "failed"],
  delivered: [],
  failed: ["rescheduled"],
  rescheduled: [],
};

/**
 * Check if a delivery item status transition is valid
 */
export function canTransitionDeliveryItem(
  from: DeliveryItemStatusType,
  to: DeliveryItemStatusType
): boolean {
  return DELIVERY_ITEM_TRANSITIONS[from].includes(to);
}

// ================================================
// PACKING STATUS WORKFLOW
// ================================================

export const PACKING_STATUSES: PackingStatusType[] = [
  "not_started",
  "in_progress",
  "completed",
  "verified",
];

export const PACKING_STATUS_LABELS: Record<PackingStatusType, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  verified: "Verified",
};

export const PACKING_STATUS_COLORS: Record<
  PackingStatusType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  not_started: "outline",
  in_progress: "secondary",
  completed: "default",
  verified: "default",
};

/**
 * Valid status transitions for packing
 */
export const PACKING_TRANSITIONS: Record<PackingStatusType, PackingStatusType[]> = {
  not_started: ["in_progress"],
  in_progress: ["completed", "not_started"],
  completed: ["verified", "in_progress"],
  verified: [],
};

/**
 * Check if a packing status transition is valid
 */
export function canTransitionPacking(
  from: PackingStatusType,
  to: PackingStatusType
): boolean {
  return PACKING_TRANSITIONS[from].includes(to);
}

// ================================================
// TROLLEY STATUS
// ================================================

export const TROLLEY_STATUSES: TrolleyStatusType[] = [
  "available",
  "loaded",
  "at_customer",
  "returned",
  "damaged",
  "lost",
];

export const TROLLEY_STATUS_LABELS: Record<TrolleyStatusType, string> = {
  available: "Available",
  loaded: "Loaded",
  at_customer: "At Customer",
  returned: "Returned",
  damaged: "Damaged",
  lost: "Lost",
};

export const TROLLEY_STATUS_COLORS: Record<
  TrolleyStatusType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  available: "default",
  loaded: "secondary",
  at_customer: "secondary",
  returned: "outline",
  damaged: "destructive",
  lost: "destructive",
};

// ================================================
// ORDER STATUS UPDATE TYPES
// ================================================

export const ORDER_STATUS_UPDATE_TYPES = [
  "order_confirmed",
  "packing_started",
  "packing_completed",
  "out_for_delivery",
  "delivered",
  "delivery_delayed",
  "delivery_failed",
] as const;

export type OrderStatusUpdateType = (typeof ORDER_STATUS_UPDATE_TYPES)[number];

export const ORDER_STATUS_UPDATE_LABELS: Record<OrderStatusUpdateType, string> = {
  order_confirmed: "Order Confirmed",
  packing_started: "Packing Started",
  packing_completed: "Ready for Dispatch",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  delivery_delayed: "Delivery Delayed",
  delivery_failed: "Delivery Failed",
};

export const ORDER_STATUS_UPDATE_ICONS: Record<OrderStatusUpdateType, string> = {
  order_confirmed: "CheckCircle",
  packing_started: "Package",
  packing_completed: "PackageCheck",
  out_for_delivery: "Truck",
  delivered: "Home",
  delivery_delayed: "Clock",
  delivery_failed: "AlertCircle",
};

// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Get the appropriate order status update type based on delivery item status
 */
export function getOrderStatusUpdateType(
  deliveryItemStatus: DeliveryItemStatusType
): OrderStatusUpdateType | null {
  const statusMap: Record<DeliveryItemStatusType, OrderStatusUpdateType | null> = {
    pending: null,
    loading: null,
    in_transit: "out_for_delivery",
    delivered: "delivered",
    failed: "delivery_failed",
    rescheduled: "delivery_delayed",
  };

  return statusMap[deliveryItemStatus];
}

/**
 * Get the appropriate order status update type based on packing status
 */
export function getPackingStatusUpdateType(
  packingStatus: PackingStatusType
): OrderStatusUpdateType | null {
  const statusMap: Record<PackingStatusType, OrderStatusUpdateType | null> = {
    not_started: null,
    in_progress: "packing_started",
    completed: "packing_completed",
    verified: "packing_completed",
  };

  return statusMap[packingStatus];
}

/**
 * Generate default message for order status update
 */
export function getDefaultStatusUpdateMessage(
  statusType: OrderStatusUpdateType,
  context?: {
    estimatedDeliveryTime?: string;
    driverName?: string;
    failureReason?: string;
  }
): string {
  switch (statusType) {
    case "order_confirmed":
      return "Your order has been confirmed and is being prepared.";
    case "packing_started":
      return "We've started packing your order.";
    case "packing_completed":
      return "Your order has been packed and is ready for dispatch.";
    case "out_for_delivery":
      if (context?.driverName) {
        return `Your order is on its way with driver ${context.driverName}.`;
      }
      return "Your order is out for delivery.";
    case "delivered":
      return "Your order has been delivered. Thank you for your business!";
    case "delivery_delayed":
      return "Your delivery has been delayed. We'll update you with a new delivery time soon.";
    case "delivery_failed":
      if (context?.failureReason) {
        return `Delivery attempt failed: ${context.failureReason}. We'll contact you to reschedule.`;
      }
      return "We were unable to deliver your order. We'll contact you to reschedule.";
    default:
      return "";
  }
}
