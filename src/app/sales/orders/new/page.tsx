
"use client";
import * as React from "react";
import { getSaleableProducts, getCustomers } from "@/server/sales/queries.server";
import { OrderPlacementClient } from "./OrderPlacementClient";

type Props = {
    customers: any[];
    onOrderCreated: () => void;
};

export default function NewSalesOrderPage({ customers, onOrderCreated }: Props) {
  const [products, setProducts] = React.useState<any[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // This is a client component, so we must fetch data via an API
    // or receive it as props. We can create an API endpoint if needed.
    // For now, let's assume products are fetched. A real implementation
    // would fetch from `/api/sales/products`
    const fetchProducts = async () => {
      // In a real app, this would be an API call:
      // const res = await fetch('/api/sales/products');
      // const data = await res.json();
      // setProducts(data.products);
      // setCategories(data.categories);
      
      // Simulating fetch
      setLoading(false);
    };

    fetchProducts();
  }, []);

  if (loading) {
      return <div>Loading products...</div>;
  }

  return (
    <OrderPlacementClient products={products} categories={categories} />
  );
}
