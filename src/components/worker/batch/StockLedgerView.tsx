"use client";

import * as React from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { StockMovement, StockMovementType } from "@/lib/history-types";

interface StockLedgerViewProps {
  batchId: string;
  className?: string;
}

const TYPE_META: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    icon: "in" | "out" | "reserved" | null;
  }
> = {
  initial: { label: "Initial", variant: "default", icon: "in" },
  checkin: { label: "Check In", variant: "default", icon: "in" },
  create: { label: "Created", variant: "default", icon: "in" },
  transplant_in: { label: "Transplant In", variant: "default", icon: "in" },
  transplant_from: { label: "Transplant In", variant: "default", icon: "in" },
  propagation_in: { label: "Propagation In", variant: "default", icon: "in" },
  transplant_out: { label: "Transplant Out", variant: "secondary", icon: "out" },
  transplant_to: { label: "Transplant Out", variant: "secondary", icon: "out" },
  allocated: { label: "Reserved", variant: "outline", icon: "reserved" },
  picked: { label: "Sold", variant: "destructive", icon: "out" },
  sale: { label: "Sold", variant: "destructive", icon: "out" },
  dispatch: { label: "Dispatched", variant: "destructive", icon: "out" },
  loss: { label: "Loss", variant: "destructive", icon: "out" },
  dump: { label: "Dumped", variant: "destructive", icon: "out" },
  adjustment: { label: "Adjustment", variant: "outline", icon: null },
};

interface StockLedgerResponse {
  movements: StockMovement[];
}

const fetcher = async (url: string): Promise<StockMovement[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch stock movements");
  const data: StockLedgerResponse = await res.json();
  return data.movements || [];
};

/**
 * Mobile-optimized stock ledger view for worker app.
 * Shows stock movement history in a compact, scrollable list.
 */
export function StockLedgerView({ batchId, className }: StockLedgerViewProps) {
  const {
    data: movements = [],
    error,
    isLoading,
  } = useSWR(
    batchId ? `/api/production/batches/${batchId}/stock-movements` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Calculate summary
  const summary = React.useMemo(() => {
    if (movements.length === 0) return null;

    const totalIn = movements
      .filter((m) => m.quantity > 0)
      .reduce((sum, m) => sum + m.quantity, 0);
    const totalOut = Math.abs(
      movements
        .filter((m) => m.quantity < 0)
        .reduce((sum, m) => sum + m.quantity, 0)
    );
    const currentBalance =
      movements[movements.length - 1]?.runningBalance ?? 0;

    return { totalIn, totalOut, currentBalance };
  }, [movements]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-emerald-600" />
            Stock Ledger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-emerald-600" />
            Stock Ledger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-muted-foreground">
              Failed to load stock movements
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4 text-emerald-600" />
          Stock Ledger
        </CardTitle>
        {summary && (
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-2">
            <span>
              In:{" "}
              <span className="font-semibold text-emerald-600">
                +{summary.totalIn.toLocaleString()}
              </span>
            </span>
            <span>
              Out:{" "}
              <span className="font-semibold text-rose-600">
                -{summary.totalOut.toLocaleString()}
              </span>
            </span>
            <span>
              Balance:{" "}
              <span className="font-semibold text-foreground">
                {summary.currentBalance.toLocaleString()}
              </span>
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {movements.length === 0 ? (
          <div className="text-muted-foreground py-6 text-center text-sm">
            No stock movements recorded yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto -mx-2 px-2">
            {movements.map((movement) => (
              <MovementRow key={movement.id} movement={movement} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Individual movement row - mobile optimized
 */
function MovementRow({ movement }: { movement: StockMovement }) {
  const meta = TYPE_META[movement.type] || {
    label: movement.type,
    variant: "outline" as const,
    icon: null,
  };
  const isAllocation = movement.type === "allocated";
  const isIn = movement.quantity > 0;
  const isOut = movement.quantity < 0 && !isAllocation;

  // Background color based on movement type
  const bgClass = isAllocation
    ? "bg-amber-50/50"
    : isOut
      ? "bg-rose-50/50"
      : isIn
        ? "bg-emerald-50/50"
        : "";

  return (
    <div
      className={`rounded-lg border p-3 ${bgClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Type badge with icon */}
          <div className="flex items-center gap-1.5 mb-1">
            {meta.icon === "in" && (
              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
            )}
            {meta.icon === "out" && (
              <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" />
            )}
            {meta.icon === "reserved" && (
              <Clock className="h-3.5 w-3.5 text-amber-600" />
            )}
            <Badge
              variant={meta.variant}
              className={`text-xs ${isAllocation ? "bg-amber-100 text-amber-800 border-amber-300" : ""}`}
            >
              {meta.label}
            </Badge>
          </div>

          {/* Title */}
          <p className="text-sm font-medium truncate">{movement.title}</p>

          {/* Details/destination if available */}
          {movement.details && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {movement.details}
            </p>
          )}
          {movement.destination?.customerName && (
            <p className="text-xs text-sky-600 truncate mt-0.5">
              {movement.destination.customerName}
            </p>
          )}

          {/* Date */}
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(movement.at)}
          </p>
        </div>

        {/* Quantity and balance */}
        <div className="text-right flex-shrink-0">
          <div
            className={`text-base font-semibold tabular-nums ${
              isAllocation
                ? "text-amber-600"
                : isOut
                  ? "text-rose-600"
                  : isIn
                    ? "text-emerald-600"
                    : ""
            }`}
          >
            {isAllocation
              ? `(${Math.abs(movement.quantity).toLocaleString()})`
              : isIn
                ? `+${movement.quantity.toLocaleString()}`
                : movement.quantity.toLocaleString()}
          </div>
          {movement.runningBalance != null && (
            <div className="text-xs text-muted-foreground">
              Bal: {movement.runningBalance.toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export default StockLedgerView;
