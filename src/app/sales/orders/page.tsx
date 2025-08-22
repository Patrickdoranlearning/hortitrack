import { adminDb } from "@/server/db/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type Order = {
  id: string;
  customerId: string;
  storeId: string;
  status: string;
  createdAt?: any;
  totalsIncVat?: number;
};

export default async function OrdersPage() {
  const snap = await adminDb.collection("sales_orders").orderBy("createdAt", "desc").limit(50).get();
  const orders: Order[] = [];
  snap.forEach(d => orders.push({ id: d.id, ...(d.data() as any) }));

  return (
    <Card>
      <CardHeader><CardTitle>Sales Orders</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Order ID</th>
                <th className="py-2">Customer</th>
                <th className="py-2">Store</th>
                <th className="py-2">Status</th>
                <th className="py-2">Created</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b">
                  <td className="py-2 font-medium">{o.id}</td>
                  <td className="py-2">{o.customerId}</td>
                  <td className="py-2">{o.storeId}</td>
                  <td className="py-2">{o.status}</td>
                  <td className="py-2">{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : ""}</td>
                  <td className="py-2 text-right">
                    <Link className="underline" href={`/sales/orders/${o.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
