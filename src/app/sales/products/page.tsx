
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, ArrowLeft } from "lucide-react";

export default function ProductsPage() {
  return (
    <div className="container mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl">Products</h1>
          <p className="text-muted-foreground">Manage the customer-facing sales catalog.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
                <Link href="/settings">
                    <ArrowLeft />
                    Back to Data Management
                </Link>
            </Button>
            <Button disabled>
                <Plus />
                Add Product
            </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Product Catalog</CardTitle>
          <CardDescription>This feature is coming soon.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center text-muted-foreground">
            <p>Product management functionality will be available here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
