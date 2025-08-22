import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SalesHome() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild><Link href="/sales/orders/new">Create Order</Link></Button>
          <Button variant="secondary" asChild><Link href="/sales/orders">View Orders</Link></Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Open Orders</CardTitle></CardHeader>
        <CardContent>Coming soon: counts by status.</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent>Coming soon: overdue & due this week.</CardContent>
      </Card>
    </div>
  );
}
