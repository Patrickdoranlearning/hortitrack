
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SalesOrdersPanel } from "@/components/sales/SalesOrdersPanel";

export default function SalesLandingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <Button asChild>
          <Link href="/sales/webshop">Create order</Link>
        </Button>
      </div>

      <SalesOrdersPanel />
    </div>
  );
}
