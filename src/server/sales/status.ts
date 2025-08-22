import { z } from "zod";

export const OrderStatus = z.enum([
  "draft",
  "confirmed",
  "picking",
  "ready",
  "dispatched",
  "delivered",
  "void",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  draft: ["confirmed", "void"],
  confirmed: ["picking", "void"],
  picking: ["ready", "void"],
  ready: ["dispatched", "void"],
  dispatched: ["delivered"],
  delivered: [],
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
