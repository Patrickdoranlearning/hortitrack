
"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import OrderStatusBadge from "./OrderStatusBadge";

type OrderListItem = {
  id: string;
  customerName: string;
  customerId: string | null;
  status: string;
  createdAt: string;
  totalsIncVat?: number;
};

export function SalesOrdersPanel() {
  const [orders, setOrders] = React.useState<OrderListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/sales/orders", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load orders");
        setOrders(json.orders ?? []);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load");
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filteredOrders = React.useMemo(() => {
    return orders
      .filter(o => statusFilter === 'all' || o.status === statusFilter)
      .filter(o => {
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return (
          o.id.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q)
        );
      });
  }, [orders, statusFilter, searchQuery]);


  if (loading) return <div className="text-sm text-slate-600">Loading orders…</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>A list of the most recent sales orders.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by ID or customer..." 
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="picking">Picking</SelectItem>
                        <SelectItem value="ready">Ready</SelectItem>
                        <SelectItem value="dispatched">Dispatched</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="void">Void</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    No orders found.
                  </TableCell>
                </TableRow>
              )}
              {filteredOrders.map((o) => (
                <TableRow key={o.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/sales/orders/${o.id}`}>
                      {o.id.slice(0, 8)}...
                    </Link>
                  </TableCell>
                  <TableCell>{o.customerName || "—"}</TableCell>
                  <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                  <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-mono">
                    {o.totalsIncVat != null ? `€${o.totalsIncVat.toFixed(2)}` : 'N/A'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
