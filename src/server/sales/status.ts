import { z } from "zod";

// Order status enum from database: draft, confirmed, picking, ready, packed, dispatched, delivered, cancelled, void
export const OrderStatus = z.enum([
  "draft",
  "confirmed",
  "picking",
  "ready",
  "packed",
  "dispatched",
  "delivered",
  "cancelled",
  "void",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  draft: ["confirmed", "void"],
  confirmed: ["picking", "void"],
  picking: ["packed", "void"],
  ready: ["dispatched", "void"], // legacy status
  packed: ["dispatched", "void"],
  dispatched: ["delivered"],
  delivered: [],
  cancelled: [],
  void: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return NEXT[from]?.includes(to) ?? false;
}

export function nextStatus(from: OrderStatus): OrderStatus | null {
  return NEXT[from]?.find(s => s !== "void") ?? null;
}

export function allNext(from: OrderStatus): OrderStatus[] {
  return NEXT[from] ?? [];
}
