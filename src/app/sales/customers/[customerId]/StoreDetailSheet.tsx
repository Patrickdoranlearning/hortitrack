"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  MapPin,
  ShoppingCart,
  TrendingUp,
  Calendar,
  Package,
  Store,
  Loader2,
  Settings,
  Truck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import type { StoreWithMetrics, StoreOrder, StoreTopProduct, StorePreferences, StoreOrderFrequency } from "./types";
import { fetchStoreOrders, fetchStoreTopProducts, fetchStoreWithPreferences, fetchStoreOrderFrequency } from "./store-data";
import { StorePreferencesForm } from "./StorePreferencesForm";
import { OrderFrequencyChart } from "@/components/customers/OrderFrequencyChart";

interface StoreDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: StoreWithMetrics | null;
  customerId: string;
  currency: string;
}

type TabKey = "overview" | "orders" | "preferences";

export function StoreDetailSheet({
  open,
  onOpenChange,
  store,
  customerId,
  currency,
}: StoreDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [topProducts, setTopProducts] = useState<StoreTopProduct[]>([]);
  const [preferences, setPreferences] = useState<StorePreferences>({});
  const [orderFrequency, setOrderFrequency] = useState<StoreOrderFrequency | null>(null);
  const [loading, setLoading] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currency || "EUR",
    }).format(value);
  };

  // Load store data when sheet opens
  useEffect(() => {
    if (open && store) {
      setLoading(true);
      setActiveTab("overview");

      const loadData = async () => {
        const supabase = createClient();

        // Fetch all data in parallel
        const [ordersData, productsData, storeData, frequencyData] = await Promise.all([
          fetchStoreOrders(supabase, store.addressId, 50),
          fetchStoreTopProducts(supabase, store.addressId, 10),
          fetchStoreWithPreferences(supabase, store.addressId),
          fetchStoreOrderFrequency(supabase, store.addressId),
        ]);

        setOrders(ordersData);
        setTopProducts(productsData);
        setPreferences(storeData?.preferences || {});
        setOrderFrequency(frequencyData);
        setLoading(false);
      };

      loadData();
    }
  }, [open, store]);

  if (!store) return null;

  const displayName = store.storeName || store.label;
  const location = [store.city, store.county].filter(Boolean).join(", ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-muted-foreground" />
            <SheetTitle>{displayName}</SheetTitle>
          </div>
          <SheetDescription>
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Store Stats */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <StatCard
            icon={<ShoppingCart className="h-4 w-4" />}
            label="Total Orders"
            value={store.orderCount.toString()}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Revenue"
            value={store.orderCount > 0 ? formatCurrency(store.totalRevenue) : "---"}
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label="Avg. Order"
            value={store.orderCount > 0 ? formatCurrency(store.avgOrderValue) : "---"}
          />
          <StatCard
            icon={<Calendar className="h-4 w-4" />}
            label="Last Order"
            value={
              store.lastOrderAt
                ? format(new Date(store.lastOrderAt), "dd MMM")
                : "---"
            }
          />
        </div>

        {/* Preferences Summary */}
        {(preferences.preferredDeliveryDay || preferences.preferredTrolleyType) && (
          <div className="flex flex-wrap gap-2">
            {preferences.preferredDeliveryDay && (
              <Badge variant="outline" className="text-xs">
                <Calendar className="mr-1 h-3 w-3" />
                {preferences.preferredDeliveryDay.charAt(0).toUpperCase() + preferences.preferredDeliveryDay.slice(1)}
              </Badge>
            )}
            {preferences.preferredTrolleyType && preferences.preferredTrolleyType !== "none" && (
              <Badge variant="outline" className="text-xs">
                <Truck className="mr-1 h-3 w-3" />
                {preferences.preferredTrolleyType.charAt(0).toUpperCase() + preferences.preferredTrolleyType.slice(1)}
              </Badge>
            )}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">
              Orders ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Settings className="mr-1 h-3.5 w-3.5" />
              Preferences
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <StoreOverview
                store={store}
                orders={orders.slice(0, 5)}
                topProducts={topProducts}
                orderFrequency={orderFrequency}
                formatCurrency={formatCurrency}
              />
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <StoreOrdersTab
                orders={orders}
                formatCurrency={formatCurrency}
              />
            )}
          </TabsContent>

          <TabsContent value="preferences" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <StorePreferencesForm
                addressId={store.addressId}
                initialPreferences={preferences}
                onSaved={(newPrefs) => setPreferences(newPrefs)}
              />
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="text-lg font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function StoreOverview({
  store,
  orders,
  topProducts,
  orderFrequency,
  formatCurrency,
}: {
  store: StoreWithMetrics;
  orders: StoreOrder[];
  topProducts: StoreTopProduct[];
  orderFrequency: StoreOrderFrequency | null;
  formatCurrency: (value: number) => string;
}) {
  return (
    <div className="space-y-6">
      {/* Order Frequency Chart */}
      {orderFrequency && (
        <OrderFrequencyChart
          ordersByMonth={orderFrequency.ordersByMonth}
          ordersLast12Months={orderFrequency.ordersLast12Months}
          averageDaysBetweenOrders={orderFrequency.averageDaysBetweenOrders}
        />
      )}

      {/* Recent Orders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Orders</CardTitle>
          <CardDescription>Last 5 orders to this location</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No orders yet for this store
            </p>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/sales/orders/${order.id}`}
                  className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(order.createdAt), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">
                      {formatCurrency(order.totalIncVat)}
                    </p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top Products</CardTitle>
          <CardDescription>Most ordered products at this store</CardDescription>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No order history for this store
            </p>
          ) : (
            <div className="space-y-2">
              {topProducts.slice(0, 5).map((product, index) => (
                <div
                  key={product.skuId}
                  className="flex items-center justify-between p-2 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-sm truncate max-w-[200px]" title={product.productName}>
                        {product.productName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.orderCount} order{product.orderCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{product.totalQuantity}</p>
                    <p className="text-xs text-muted-foreground">units</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StoreOrdersTab({
  orders,
  formatCurrency,
}: {
  orders: StoreOrder[];
  formatCurrency: (value: number) => string;
}) {
  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No orders found for this store</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link
                    href={`/sales/orders/${order.id}`}
                    className="font-medium hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  {format(new Date(order.createdAt), "dd MMM yyyy")}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="text-right">{order.itemCount}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(order.totalIncVat)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "outline",
    confirmed: "secondary",
    picking: "secondary",
    ready: "default",
    dispatched: "default",
    delivered: "default",
    cancelled: "destructive",
    void: "destructive",
  };

  const labels: Record<string, string> = {
    draft: "Draft",
    confirmed: "Confirmed",
    picking: "Picking",
    ready: "Ready",
    ready_for_dispatch: "Ready",
    dispatched: "Dispatched",
    delivered: "Delivered",
    cancelled: "Cancelled",
    void: "Void",
  };

  return (
    <Badge variant={variants[status] || "outline"} className="text-xs">
      {labels[status] || status}
    </Badge>
  );
}
