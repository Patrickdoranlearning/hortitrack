
import { adminDb } from "@/server/db/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";


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
     <div className="container mx-auto max-w-7xl p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 className="font-headline text-4xl">Sales Orders</h1>
                <p className="text-muted-foreground">Browse and manage all customer sales orders.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                    <Link href="/settings">
                        <ArrowLeft />
                        Back to Data Management
                    </Link>
                </Button>
                <Button asChild>
                    <Link href="/sales/orders/new">
                        <Plus />
                        Create Order
                    </Link>
                </Button>
            </div>
        </div>
        <Card>
        <CardHeader>
            <CardTitle>All Orders</CardTitle>
            <CardDescription>A list of all sales orders in the system.</CardDescription>
        </CardHeader>
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
    </div>
  );
}
