import { adminDb } from "@/server/db/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CustomersPage() {
  const snap = await adminDb.collection("customers").orderBy("name").limit(100).get();
  const customers = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

  return (
    <Card>
      <CardHeader><CardTitle>Customers</CardTitle></CardHeader>
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
  );
}
