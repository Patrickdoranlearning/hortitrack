import { adminDb } from "@/server/db/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InvoicesPage() {
  const snap = await adminDb.collection("invoices").orderBy("invoiceDate", "desc").limit(50).get();
  const invoices = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

  return (
    <Card>
      <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Number</th>
              <th className="py-2">Customer</th>
              <th className="py-2">Date</th>
              <th className="py-2">Total</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i: any) => (
              <tr key={i.id} className="border-b">
                <td className="py-2 font-medium">{i.number ?? i.id}</td>
                <td className="py-2">{i.customerId}</td>
                <td className="py-2">{i.invoiceDate?.toDate ? i.invoiceDate.toDate().toLocaleDateString() : ""}</td>
                <td className="py-2">{i.totalsIncVat != null ? `€${Number(i.totalsIncVat).toFixed(2)}` : "-"}</td>
                <td className="py-2 capitalize">{i.status ?? "draft"}</td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
