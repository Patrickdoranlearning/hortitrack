
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageFrame } from "@/ui/templates/PageFrame";

export default function WebshopLanding() {
  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Webshop</h1>
        <Card>
          <CardHeader>
            <CardTitle>Select products to start an order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>
              Browse saleable products, filter by category/size, and add to a new order.
            </p>
            <Button asChild>
              <Link href="/sales/orders/new">Start new order</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageFrame>
  );
}
