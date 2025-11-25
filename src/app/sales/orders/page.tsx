
import { supabaseAdmin } from "@/server/db/supabaseAdmin";
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

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
    const { data: ordersData, error } = await supabaseAdmin
        .from("sales_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

    if (error) {
        console.error("Error fetching orders:", error);
    }

    const orders: Order[] = (ordersData || []).map(d => ({
        id: d.id,
        customerId: d.customer_id,
        storeId: d.store_id,
        status: d.status,
        createdAt: d.created_at,
        totalsIncVat: d.totals_inc_vat,
    }));

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
                                        <td className="py-2">{o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}</td>
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
