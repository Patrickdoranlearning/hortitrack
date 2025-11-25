import { supabaseAdmin } from "@/server/db/supabaseAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { data: invoicesData, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .order("invoice_date", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching invoices:", error);
  }

  const invoices = invoicesData || [];

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
                <td className="py-2">{i.customer_id}</td>
                <td className="py-2">{i.invoice_date ? new Date(i.invoice_date).toLocaleDateString() : ""}</td>
                <td className="py-2">{i.totals_inc_vat != null ? `€${Number(i.totals_inc_vat).toFixed(2)}` : "-"}</td>
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
