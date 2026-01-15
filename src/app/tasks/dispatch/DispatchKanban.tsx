"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  User,
  ArrowRight,
  RefreshCw,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/http/fetchJson";
import type { DispatchBoardOrder, DispatchStage } from "@/lib/dispatch/types";

type KanbanColumn = {
  id: DispatchStage;
  title: string;
  description: string;
  color: string;
  icon: React.ElementType;
};

const COLUMNS: KanbanColumn[] = [
  {
    id: "to_pick",
    title: "To Pick",
    description: "Orders waiting to be picked",
    color: "bg-slate-50 dark:bg-slate-900/50",
    icon: ClipboardList,
  },
  {
    id: "picking",
    title: "Picking",
    description: "Orders being picked",
    color: "bg-amber-50 dark:bg-amber-950/30",
    icon: Package,
  },
  {
    id: "ready_to_load",
    title: "Ready to Load",
    description: "Picked and ready for dispatch",
    color: "bg-green-50 dark:bg-green-950/30",
    icon: CheckCircle2,
  },
  {
    id: "on_route",
    title: "On Route",
    description: "Orders in transit",
    color: "bg-blue-50 dark:bg-blue-950/30",
    icon: Truck,
  },
];

type BoardResponse = {
  orders: DispatchBoardOrder[];
};

export function DispatchKanban() {
  // Fetch dispatch board data
  const { data, mutate, isLoading } = useSWR<BoardResponse>(
    "/api/dispatch/board",
    (url) => fetchJson(url),
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  const orders = data?.orders ?? [];

  // Group orders by stage
  const ordersByStage = React.useMemo(() => {
    const grouped: Record<DispatchStage, DispatchBoardOrder[]> = {
      to_pick: [],
      picking: [],
      ready_to_load: [],
      on_route: [],
    };

    for (const order of orders) {
      if (grouped[order.stage]) {
        grouped[order.stage].push(order);
      }
    }

    return grouped;
  }, [orders]);

  // Calculate stats
  const stats = React.useMemo(() => ({
    toPick: ordersByStage.to_pick.length,
    picking: ordersByStage.picking.length,
    readyToLoad: ordersByStage.ready_to_load.length,
    onRoute: ordersByStage.on_route.length,
    total: orders.length,
  }), [ordersByStage, orders.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Truck className="h-12 w-12 text-muted-foreground/30" />
          <h3 className="mt-4 font-semibold">No active dispatch tasks</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Orders ready for dispatch will appear here.
          </p>
          <Link href="/dispatch/manager">
            <Button className="mt-4" variant="outline">
              <Truck className="mr-2 h-4 w-4" />
              Go to Dispatch Manager
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {stats.toPick} to pick
        </span>
        <span className="flex items-center gap-1 text-amber-600">
          <Package className="h-4 w-4" />
          {stats.picking} picking
        </span>
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          {stats.readyToLoad} ready
        </span>
        <span className="flex items-center gap-1 text-blue-600">
          <Truck className="h-4 w-4" />
          {stats.onRoute} on route
        </span>
        <Button variant="ghost" size="sm" onClick={() => mutate()} className="ml-auto">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <div
            key={column.id}
            className={cn(
              "flex-shrink-0 w-80 rounded-lg p-3",
              column.color
            )}
          >
            {/* Column Header */}
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <column.icon className="h-4 w-4" />
                  <h3 className="font-semibold">{column.title}</h3>
                </div>
                <Badge variant="secondary">{ordersByStage[column.id].length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{column.description}</p>
            </div>

            {/* Order Cards */}
            <div className="space-y-3">
              {ordersByStage[column.id].length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                  No orders
                </div>
              ) : (
                ordersByStage[column.id].map((order) => (
                  <DispatchOrderCard key={order.id} order={order} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <Link href="/dispatch/manager">
          <Button variant="outline">
            <Truck className="mr-2 h-4 w-4" />
            Dispatch Manager
          </Button>
        </Link>
        <Link href="/dispatch/picker">
          <Button variant="outline">
            <Package className="mr-2 h-4 w-4" />
            Picking Queue
          </Button>
        </Link>
      </div>
    </div>
  );
}

// Dispatch Order Card Component
function DispatchOrderCard({ order }: { order: DispatchBoardOrder }) {
  const getPickProgress = () => {
    if (!order.pickProgress) return null;
    const { picked, total } = order.pickProgress;
    const percent = total > 0 ? Math.round((picked / total) * 100) : 0;
    return { picked, total, percent };
  };

  const progress = getPickProgress();

  return (
    <Link href={order.pickListId ? `/dispatch/picking/${order.pickListId}` : `/sales/orders/${order.id}`}>
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardHeader className="pb-2 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-medium">
                {order.orderNumber}
              </CardTitle>
              <p className="text-xs text-muted-foreground truncate">
                {order.customerName}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {/* Location */}
          {(order.county || order.eircode) && (
            <p className="text-xs text-muted-foreground">
              {order.county}
              {order.county && order.eircode && " · "}
              {order.eircode}
            </p>
          )}

          {/* Assigned Picker */}
          {order.pickerName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {order.pickerName}
            </div>
          )}

          {/* Progress Bar (for picking stage) */}
          {progress && order.stage === "picking" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Route (for on_route stage) */}
          {order.routeName && (
            <Badge
              variant="secondary"
              className={cn("text-xs", order.routeColor)}
            >
              {order.routeName}
            </Badge>
          )}

          {/* Trolleys */}
          {order.trolleysEstimated > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Package className="h-3 w-3" />
              {order.trolleysEstimated} trolley{order.trolleysEstimated !== 1 ? "s" : ""}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

