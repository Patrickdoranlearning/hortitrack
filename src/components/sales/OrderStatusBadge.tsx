"use client";
import { Badge } from "@/components/ui/badge";

export default function OrderStatusBadge({ status }: { status: string }) {
  const variant =
    status === "confirmed" ? "default" :
    status === "picking" ? "secondary" :
    status === "ready" ? "outline" :
    status === "dispatched" ? "default" :
    status === "delivered" ? "secondary" :
    status === "void" ? "destructive" : "outline";
  return <Badge variant={variant as any} className="capitalize">{status}</Badge>;
}
