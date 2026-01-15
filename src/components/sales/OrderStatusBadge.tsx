"use client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Order status enum: draft, confirmed, picking, ready (legacy), packed, dispatched, delivered, cancelled, void
const STATUS_STYLES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  draft: { variant: "outline", className: "border-gray-300 text-gray-600" },
  confirmed: { variant: "default", className: "bg-blue-500 hover:bg-blue-600" },
  picking: { variant: "secondary", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
  ready: { variant: "default", className: "bg-green-500 hover:bg-green-600" }, // legacy
  packed: { variant: "default", className: "bg-green-500 hover:bg-green-600" }, // current "ready" status
  ready_for_dispatch: { variant: "default", className: "bg-green-500 hover:bg-green-600" }, // legacy
  dispatched: { variant: "secondary", className: "bg-purple-100 text-purple-800 hover:bg-purple-200" },
  delivered: { variant: "default", className: "bg-emerald-600 hover:bg-emerald-700" },
  void: { variant: "destructive" },
  cancelled: { variant: "destructive" },
};

export default function OrderStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const style = STATUS_STYLES[normalizedStatus] || { variant: "outline" as const };
  
  return (
    <Badge 
      variant={style.variant} 
      className={cn("capitalize", style.className)}
    >
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
