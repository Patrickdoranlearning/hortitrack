
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OrderStatusBadge from "@/components/sales/OrderStatusBadge";
import { PrintLabelsButton } from "@/components/sales/PrintLabelsButton";
import { UpdateStatusButton } from "@/components/sales/UpdateStatusButton";
import { getOrderById } from "@/server/sales/queries";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { orderId: string } }) {
  const order = await getOrderById(params.orderId);
  if (!order) notFound();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Order #{order.id}</CardTitle>
          <OrderStatusBadge status={order.status} />
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Customer</div>
            <div className="font-medium">{order.customerName}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Status</div>
            <div className="font-medium">{order.status}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="font-medium">
              {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : ""}
            </div>
          </div>
          <div className="md:col-span-3 flex gap-2">
            <PrintLabelsButton orderId={order.id} />
            <UpdateStatusButton orderId={order.id} current={order.status} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lines</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Variety</th>
                <th className="py-2">Size</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Unit Price</th>
                <th className="py-2">Allocations</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l: any) => (
                <tr key={l.id} className="border-b align-top">
                  <td className="py-2">{l.plantVariety}</td>
                  <td className="py-2">{l.size}</td>
                  <td className="py-2">{l.qty}</td>
                  <td className="py-2">{l.unitPrice != null ? `€${Number(l.unitPrice).toFixed(2)}` : "-"}</td>
                  <td className="py-2">
                    {Array.isArray(l.allocations) && l.allocations.length > 0 ? (
                      <ul className="list-disc ml-5">
                        {l.allocations.map((a: any, i: number) => (
                          <li key={i}>
                            Batch {a.batchNumber ?? a.batchId} — {a.qty} pcs
                            {a.grade ? ` — Grade ${a.grade}` : ""}{a.location ? ` — ${a.location}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : <span className="text-muted-foreground">Auto allocation pending</span>}
                  </td>
                </tr>
              ))}
              {order.lines.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No lines.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
