
"use client";
import * as React from "react";
import { OrderPlacementClient } from "./OrderPlacementClient";
import { PageFrame } from "@/ui/templates/PageFrame";

type Props = {
    customers?: any[];
    onOrderCreated?: () => void;
};

export default function NewSalesOrderPage({ customers = [], onOrderCreated }: Props) {
  const [products, setProducts] = React.useState<any[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pRes] = await Promise.all([
          fetch("/api/sales/products", { cache: "no-store" }),
          // customers endpoint already exists if you want to use it in the UI later:
          // fetch("/api/sales/customers", { cache: "no-store" }),
        ]);
        const pJson = await pRes.json();
        if (!alive) return;
        if (!pRes.ok || !pJson.ok) throw new Error(pJson.error || "Failed to load products");
        const prods = pJson.products as any[];
        setProducts(prods);
        const cats = Array.from(new Set(prods.map(p => p.category || "General")));
        setCategories(["all", ...cats]);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e.message ?? "Failed to load");
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="p-4">Loading products…</div>;
  if (error)   return <div className="p-4 text-red-600">{error}</div>;

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <OrderPlacementClient products={products} categories={categories} />
    </PageFrame>
  );
}
