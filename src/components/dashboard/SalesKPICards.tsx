"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Truck,
  TrendingUp,
  TrendingDown,
  Users,
  Minus,
} from "lucide-react";
import type { DashboardStats } from "@/app/api/dashboard/stats/route";

type Props = {
  stats: DashboardStats["sales"];
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getTrendIcon(change: number) {
  if (change > 0) return TrendingUp;
  if (change < 0) return TrendingDown;
  return Minus;
}

function getTrendColor(change: number): string {
  if (change > 0) return "text-green-600";
  if (change < 0) return "text-red-600";
  return "text-muted-foreground";
}

export default function SalesKPICards({ stats }: Props) {
  const TrendIcon = getTrendIcon(stats.weeklyRevenueChange);
  const trendColor = getTrendColor(stats.weeklyRevenueChange);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Pending Orders */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-900/30">
              <ShoppingBag className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Pending Orders</p>
              <p className="text-2xl font-bold">{stats.pendingOrders}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dispatch Today */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Dispatch Today</p>
              <p className="text-2xl font-bold">{stats.dispatchToday}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Revenue */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-900/30">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Weekly Revenue</p>
              <p className="text-2xl font-bold">
                {formatCurrency(stats.weeklyRevenue)}
              </p>
              <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                <span>
                  {stats.weeklyRevenueChange > 0 ? "+" : ""}
                  {stats.weeklyRevenueChange}% vs last week
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Customer */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2.5 dark:bg-purple-900/30">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">Top Customer</p>
              {stats.topCustomer ? (
                <>
                  <p className="text-lg font-bold truncate">
                    {stats.topCustomer.name}
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {stats.topCustomer.orders} orders
                  </Badge>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No orders yet</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

