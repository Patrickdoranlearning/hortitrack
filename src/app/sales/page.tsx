import { listOrders } from "@/server/sales/queries";
import SalesPageClient from "./SalesPageClient";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const orders = await listOrders();
  return <SalesPageClient initialOrders={orders} />;
}