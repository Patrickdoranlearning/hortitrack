
"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type OrderListItem = {
  id: string;
  customerName: string;
  customerId: string | null;
  status: string;
  createdAt: string;
};

export function SalesOrdersPanel() {
  const [orders, setOrders] = React.useState<OrderListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/sales/orders?limit=50", { cache: "no-store" });
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

  if (loading) return <div className="text-sm text-slate-600">Loading orders…</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;

  if (!orders.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          No orders yet.
          <div className="mt-3">
            <Button asChild>
              <Link href="/sales/webshop">Create your first order</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between space-y-0 sm:flex-row">
        <CardTitle>Recent Orders</CardTitle>
        <Button asChild>
          <Link href="/sales/webshop">Create order</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Order #</th>
                <th className="py-2">Customer</th>
                <th className="py-2">Status</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-white">
                  <td className="py-2">
                    <Link className="text-green-700 underline" href={`/sales/orders/${o.id}`}>
                      {o.id}
                    </Link>
                  </td>
                  <td className="py-2">{o.customerName || "—"}</td>
                  <td className="py-2">{o.status ?? "draft"}</td>
                  <td className="py-2">{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
