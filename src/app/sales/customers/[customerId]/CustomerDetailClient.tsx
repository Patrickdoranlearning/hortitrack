"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Pencil,
  Package,
  ShoppingCart,
  Star,
  Mail,
  Phone,
  MapPin,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CustomerSummary } from "../types";
import type { CustomerOrder, FavouriteProduct, LastOrderWeek, CustomerStats } from "./types";
import { CustomerSheet } from "../CustomerSheet";

type TabKey = "overview" | "orders" | "favourites";

interface CustomerDetailClientProps {
  customer: CustomerSummary;
  orders: CustomerOrder[];
  favouriteProducts: FavouriteProduct[];
  lastOrderWeek: LastOrderWeek;
  stats: CustomerStats;
  priceLists: Array<{ id: string; name: string; currency: string }>;
  products: Array<{ id: string; name: string; skuCode: string | null }>;
}

export default function CustomerDetailClient({
  customer,
  orders,
  favouriteProducts,
  lastOrderWeek,
  stats,
  priceLists,
  products,
}: CustomerDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: customer.currency || "EUR",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/sales/customers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              {customer.code && (
                <Badge variant="outline">{customer.code}</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-1 hover:underline">
                  <Mail className="h-3 w-3" />
                  {customer.email}
                </a>
              )}
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:underline">
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </a>
              )}
              {customer.addresses[0] && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[customer.addresses[0].city, customer.addresses[0].county].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button onClick={() => setEditSheetOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit customer
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Orders</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Avg Order Value</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(stats.averageOrderValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Last Order Week</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {lastOrderWeek ? `W${lastOrderWeek.week} '${lastOrderWeek.year.toString().slice(-2)}` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">
            Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="favourites">
            <Star className="mr-1 h-4 w-4" />
            Favourites
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab
            customer={customer}
            orders={orders}
            favouriteProducts={favouriteProducts}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        <TabsContent value="orders">
          <OrdersTab orders={orders} formatCurrency={formatCurrency} />
        </TabsContent>

        <TabsContent value="favourites">
          <FavouritesTab products={favouriteProducts} formatCurrency={formatCurrency} />
        </TabsContent>
      </Tabs>

      {/* Edit Sheet */}
      <CustomerSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        mode="edit"
        customer={customer}
        priceLists={priceLists}
        products={products}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

// =============================================================================
// OVERVIEW TAB
// =============================================================================

function OverviewTab({
  customer,
  orders,
  favouriteProducts,
  formatCurrency,
}: {
  customer: CustomerSummary;
  orders: CustomerOrder[];
  favouriteProducts: FavouriteProduct[];
  formatCurrency: (value: number) => string;
}) {
  const recentOrders = orders.slice(0, 5);
  const topProducts = favouriteProducts.slice(0, 5);
  const defaultAddress = customer.addresses.find((a) => a.isDefaultShipping) ?? customer.addresses[0];
  const primaryContact = customer.contacts.find((c) => c.isPrimary) ?? customer.contacts[0];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Country</p>
              <p className="font-medium">{customer.countryCode}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Currency</p>
              <p className="font-medium">{customer.currency}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment Terms</p>
              <p className="font-medium">{customer.paymentTermsDays} days</p>
            </div>
            <div>
              <p className="text-muted-foreground">Credit Limit</p>
              <p className="font-medium">
                {customer.creditLimit != null ? formatCurrency(customer.creditLimit) : "No limit"}
              </p>
            </div>
            {customer.vatNumber && (
              <div className="col-span-2">
                <p className="text-muted-foreground">VAT Number</p>
                <p className="font-medium">{customer.vatNumber}</p>
              </div>
            )}
          </div>

          {defaultAddress && (
            <div className="border-t pt-4">
              <p className="text-muted-foreground text-sm mb-1">Default Shipping Address</p>
              <p className="font-medium">{defaultAddress.storeName || defaultAddress.label}</p>
              <p className="text-sm text-muted-foreground">
                {[defaultAddress.line1, defaultAddress.city, defaultAddress.county, defaultAddress.eircode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          )}

          {primaryContact && (
            <div className="border-t pt-4">
              <p className="text-muted-foreground text-sm mb-1">Primary Contact</p>
              <p className="font-medium">{primaryContact.name}</p>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {primaryContact.email && (
                  <a href={`mailto:${primaryContact.email}`} className="hover:underline">
                    {primaryContact.email}
                  </a>
                )}
                {primaryContact.phone && (
                  <a href={`tel:${primaryContact.phone}`} className="hover:underline">
                    {primaryContact.phone}
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Orders</CardTitle>
          <CardDescription>Last 5 orders</CardDescription>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No orders yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/sales/orders/${order.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(order.createdAt), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(order.totalIncVat)}</p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Top Products</CardTitle>
          <CardDescription>Most frequently ordered products</CardDescription>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No order history yet
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {topProducts.map((product, index) => (
                <div key={product.skuId} className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-lg font-bold">{product.totalQuantity}</span>
                    <span className="text-sm text-muted-foreground">units</span>
                  </div>
                  <p className="font-medium text-sm truncate" title={product.productName}>
                    {product.productName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {product.orderCount} order{product.orderCount !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {customer.notes && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =============================================================================
// ORDERS TAB
// =============================================================================

function OrdersTab({
  orders,
  formatCurrency,
}: {
  orders: CustomerOrder[];
  formatCurrency: (value: number) => string;
}) {
  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No orders found for this customer</p>
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
              <TableHead>Delivery Date</TableHead>
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
                  {order.requestedDeliveryDate
                    ? format(new Date(order.requestedDeliveryDate), "dd MMM yyyy")
                    : "—"}
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

// =============================================================================
// FAVOURITES TAB
// =============================================================================

function FavouritesTab({
  products,
  formatCurrency,
}: {
  products: FavouriteProduct[];
  formatCurrency: (value: number) => string;
}) {
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Star className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No order history to calculate favourites</p>
        </CardContent>
      </Card>
    );
  }

  const maxQuantity = Math.max(...products.map((p) => p.totalQuantity));

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty Ordered</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead>Last Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product, index) => (
              <TableRow key={product.skuId}>
                <TableCell>
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {index + 1}
                  </span>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{product.productName}</p>
                    {(product.varietyName || product.sizeName) && (
                      <p className="text-xs text-muted-foreground">
                        {[product.varietyName, product.sizeName].filter(Boolean).join(" • ")}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div
                      className="h-2 bg-primary/20 rounded-full"
                      style={{ width: `${(product.totalQuantity / maxQuantity) * 60}px` }}
                    />
                    <span className="font-medium w-12 text-right">{product.totalQuantity}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(product.totalRevenue)}
                </TableCell>
                <TableCell className="text-right">{product.orderCount}</TableCell>
                <TableCell>
                  {format(new Date(product.lastOrderDate), "dd MMM yyyy")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

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
