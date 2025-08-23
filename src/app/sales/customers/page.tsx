
import { adminDb } from "@/server/db/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, ArrowLeft } from "lucide-react";

export default async function CustomersPage() {
  const snap = await adminDb.collection("customers").orderBy("name").limit(100).get();
  const customers = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

  return (
    <div className="container mx-auto max-w-7xl p-4 sm:p-6">
         <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 className="font-headline text-4xl">Customers</h1>
                <p className="text-muted-foreground">Manage all customer accounts and information.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                    <Link href="/settings">
                        <ArrowLeft />
                        Back to Data Management
                    </Link>
                </Button>
                <Button>
                    <Plus />
                    Add Customer
                </Button>
            </div>
        </div>
        <Card>
        <CardHeader>
            <CardTitle>Customer List</CardTitle>
            <CardDescription>A complete directory of all customers.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
                <tr className="text-left border-b">
                <th className="py-2">Name</th>
                <th className="py-2">Customer ID</th>
                <th className="py-2">Stores</th>
                <th className="py-2">Pricing Tier</th>
                <th className="py-2">Email</th>
                </tr>
            </thead>
            <tbody>
                {customers.map((c: any) => (
                <tr key={c.id} className="border-b">
                    <td className="py-2 font-medium">{c.name ?? c.id}</td>
                    <td className="py-2">{c.id}</td>
                    <td className="py-2">{Array.isArray(c.stores) ? c.stores.length : (c.storeCount ?? 0)}</td>
                    <td className="py-2">{c.pricingTier ?? "-"}</td>
                    <td className="py-2">{c.email ?? "-"}</td>
                </tr>
                ))}
                {customers.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No customers yet.</td></tr>
                )}
            </tbody>
            </table>
        </CardContent>
        </Card>
    </div>
  );
}
