
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, ArrowLeft, Edit } from "lucide-react";
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import type { SaleableProduct } from '@/server/sales/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

export default function ProductsPage() {
  const [products, setProducts] = React.useState<SaleableProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  React.useEffect(() => {
    let alive = true;
    async function fetchProducts() {
        try {
            const res = await fetch("/api/sales/products");
            const json = await res.json();
            if (!alive) return;
            if (!res.ok || !json.ok) {
                throw new Error(json.error || "Failed to load products");
            }
            setProducts(json.products || []);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            if (alive) setLoading(false);
        }
    }
    fetchProducts();
    return () => { alive = false; };
  }, [toast]);


  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <div className="space-y-6">
        <ModulePageHeader
            title="Products"
            description="Manage the customer-facing sales catalog and link them to available batches."
            actionsSlot={
                <>
                    <Button asChild variant="outline">
                        <Link href="/settings">
                            <ArrowLeft />
                            Back to Data Management
                        </Link>
                    </Button>
                    <Button>
                        <Plus />
                        Add Product
                    </Button>
                </>
            }
        />
        <Card>
          <CardHeader>
            <CardTitle>Product Catalog</CardTitle>
            <CardDescription>
              A list of all saleable products. The available quantity is automatically calculated from linked batches.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map(product => (
                        <div key={product.id} className="border p-4 rounded-lg flex flex-col justify-between">
                           <div>
                                <div className="flex items-start gap-4">
                                    <Image
                                        src={product.imageUrl || 'https://picsum.photos/seed/product/100/100'}
                                        alt={product.plantVariety}
                                        width={80}
                                        height={80}
                                        className="rounded-md object-cover"
                                        data-ai-hint="plant product"
                                    />
                                    <div className="flex-1">
                                        <h3 className="font-semibold">{product.plantVariety}</h3>
                                        <p className="text-sm text-muted-foreground">{product.size}</p>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-muted-foreground">Available</p>
                                        <p className="font-bold text-lg">{product.totalQuantity.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Status</p>
                                        <p>{product.status}</p>
                                    </div>
                                </div>
                           </div>
                           <div className="mt-4 flex justify-end">
                                <Button variant="outline" size="sm">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                           </div>
                        </div>
                    ))}
                </div>
            )}
             { !loading && products.length === 0 && (
                <div className="py-20 text-center text-muted-foreground">
                    <p>No products found in the catalog.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageFrame>
  );
}

