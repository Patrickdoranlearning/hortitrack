
import { getSaleableProducts } from "@/server/sales/queries";
import { OrderPlacementClient } from "./OrderPlacementClient";

export const dynamic = 'force-dynamic';

export default async function CreateOrderPage() {
  const products = await getSaleableProducts();

  const categories = Array.from(new Set(products.map(p => p.category ?? "Uncategorized")));

  return (
    <OrderPlacementClient products={products} categories={categories} />
  );
}
